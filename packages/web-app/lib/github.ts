import { FileContext } from '@codeatlas/core';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') {
      return null;
    }
    
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    
    return {
      owner: parts[0],
      repo: parts[1].replace('.git', ''),
      defaultBranch: 'main', // Will be fetched from API
    };
  } catch {
    return null;
  }
}

/**
 * Fetch repository tree from GitHub API with fallback to cloning
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<FileContext[]> {
  // Try GitHub API first
  try {
    return await fetchRepoTreeFromAPI(owner, repo, branch);
  } catch (apiError) {
    console.warn('GitHub API failed, falling back to git clone:', apiError);
    // Fallback to cloning
    try {
      return await fetchRepoTreeFromClone(owner, repo, branch);
    } catch (cloneError) {
      throw new Error(
        `Both GitHub API and git clone failed. API error: ${apiError instanceof Error ? apiError.message : 'Unknown'}. Clone error: ${cloneError instanceof Error ? cloneError.message : 'Unknown'}`
      );
    }
  }
}

/**
 * Fetch repository tree from GitHub API
 */
async function fetchRepoTreeFromAPI(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<FileContext[]> {
  const files: FileContext[] = [];
  
  // Fetch repository contents recursively
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Filter for code files and limit to reasonable number
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php', '.cs', '.swift'];
  const codeFiles = data.tree
    .filter((item: any) => 
      item.type === 'blob' && 
      codeExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('dist') &&
      !item.path.includes('build') &&
      !item.path.includes('.git')
    )
    .slice(0, 20); // Limit to 20 files for performance
  
  // Fetch content for each file
  for (const file of codeFiles) {
    try {
      const contentResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        if (contentData.content && contentData.encoding === 'base64') {
          const content = Buffer.from(contentData.content, 'base64').toString('utf-8');
          files.push({
            path: file.path,
            content: content.substring(0, 5000), // Limit content size
            language: getLanguageFromPath(file.path),
            size: content.length,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${file.path}:`, error);
    }
  }
  
  if (files.length === 0) {
    throw new Error('No code files found via GitHub API');
  }
  
  return files;
}

/**
 * Scan directory for code files (helper function for clone fallback)
 */
function scanDirectoryForCodeFiles(
  dir: string,
  basePath: string,
  files: FileContext[],
  codeExtensions: string[]
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
    
    // Skip ignored directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.git' ||
      entry.name === '.next' ||
      entry.name === 'coverage' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectoryForCodeFiles(fullPath, relativePath, files, codeExtensions);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (codeExtensions.includes(ext) && files.length < 20) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({
            path: relativePath,
            content: content.substring(0, 5000), // Limit content size
            language: getLanguageFromPath(relativePath),
            size: content.length,
          });
        } catch (error) {
          console.error(`Failed to read ${relativePath}:`, error);
        }
      }
    }
  }
}

/**
 * Fetch repository tree by cloning to temp directory
 */
async function fetchRepoTreeFromClone(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<FileContext[]> {
  const tempDir = path.join(os.tmpdir(), `codeatlas-${owner}-${repo}-${Date.now()}`);
  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Clone repository (shallow clone for speed)
    console.log(`Cloning ${repoUrl} to ${tempDir}...`);
    try {
      // Try with specific branch first
      execSync(`git clone --depth 1 --branch ${branch} ${repoUrl} .`, {
        cwd: tempDir,
        stdio: 'pipe',
        timeout: 60000, // 60 second timeout
      });
    } catch (branchError) {
      // If branch fails, try default branch (main/master)
      console.warn(`Branch ${branch} failed, trying default branch...`);
      try {
        execSync(`git clone --depth 1 ${repoUrl} .`, {
          cwd: tempDir,
          stdio: 'pipe',
          timeout: 60000,
        });
      } catch (cloneError) {
        throw new Error(`Failed to clone repository: ${cloneError instanceof Error ? cloneError.message : 'Unknown error'}`);
      }
    }
    
    // Scan for code files
    const files: FileContext[] = [];
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php', '.cs', '.swift'];
    
    scanDirectoryForCodeFiles(tempDir, '', files, codeExtensions);
    
    if (files.length === 0) {
      throw new Error('No code files found in cloned repository');
    }
    
    return files;
  } finally {
    // Cleanup: remove temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory:', cleanupError);
    }
  }
}

/**
 * Get default branch for a repository
 */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!response.ok) {
      return 'main'; // Fallback to main
    }
    
    const data = await response.json();
    return data.default_branch || 'main';
  } catch {
    return 'main';
  }
}

/**
 * Infer language from file path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'cs': 'csharp',
    'swift': 'swift',
  };
  return langMap[ext || ''] || 'unknown';
}

