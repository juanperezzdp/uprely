import { Throttle } from '@nestjs/throttler';

export function AuthRateLimit(): MethodDecorator & ClassDecorator {
  return Throttle({
    auth: {},
  });
}
