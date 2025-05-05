import { ZodError } from 'zod';

 /**
  * Formats Zod validation errors or other errors into a user-friendly string.
  *
  * @param error - The error object (can be a ZodError or any other error).
  * @param defaultMessage - A default message to return if the error is not a ZodError or has no specific messages.
  * @returns A user-friendly error message string.
  */
 export function zodErrorHandler(error: any, defaultMessage: string = "An error occurred."): string {
   if (error instanceof ZodError) {
     // Extract messages from Zod errors
     const errorMessages = error.errors.map(err => {
       // Provide more context if needed, e.g., include the field path
       // return `${err.path.join('.')}: ${err.message}`;
       return err.message;
     });
     // Join multiple messages or return the first one
     return errorMessages.length > 0 ? errorMessages.join('; ') : defaultMessage;
   } else if (error instanceof Error) {
     // Handle standard JavaScript errors
     return error.message || defaultMessage;
   } else {
     // Handle other types of errors or return the default message
     return defaultMessage;
   }
 }
