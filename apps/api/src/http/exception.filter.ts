import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { captureException } from '@fable/observability';

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException) || exception.getStatus() >= 500) {
      captureException(exception);
    }
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();
    const described = describeException(exception);
    response.status(described.status).send({
      statusCode: described.status,
      message: described.message,
      simulated: true,
    });
  }
}

function describeException(exception: unknown): { status: number; message: string } {
  if (!(exception instanceof HttpException)) {
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
  const status = exception.getStatus();
  const body = exception.getResponse();
  if (typeof body === 'string') return { status, message: body };
  if (typeof body === 'object' && body && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return { status, message };
    if (Array.isArray(message)) return { status, message: message.map(String).join('; ') };
  }
  return { status, message: exception.message };
}
