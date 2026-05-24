import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow(key: string): string {
              if (key === 'SWAGGER_PATH') {
                return 'docs';
              }

              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getApiInfo', () => {
    it('should return api metadata', () => {
      expect(appController.getApiInfo()).toMatchObject({
        name: 'uptimewatch-api',
        status: 'ok',
        docsPath: '/docs',
      });
      expect(typeof appController.getApiInfo().timestamp).toBe('string');
    });
  });
});
