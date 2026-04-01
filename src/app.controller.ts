import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/decorators/public.decorator';
import { parseGithubRepoWebUrl } from './feedback/utils/parse-github-repo';

@Controller()
export class AppController {
  @Public()
  @SkipThrottle()
  @Get('health')
  health() {
    const github = parseGithubRepoWebUrl(process.env.GITHUB_REPO_WEB_URL);
    return {
      status: 'ok',
      ...(process.env.APP_VERSION && { version: process.env.APP_VERSION }),
      ...(process.env.UI_VERSION && { uiVersion: process.env.UI_VERSION }),
      ...(github && {
        githubRepoUrl: github.githubRepoUrl,
        githubIssuesUrl: github.githubIssuesUrl,
      }),
    };
  }
}
