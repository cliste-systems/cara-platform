/** Background challenge events must never dismiss a failed form submission. */
export type AuthFeedbackState = { error: string | null; securityError: string | null };
export type AuthFeedbackEvent =
 | { type: "submit" }
 | { type: "request-failed"; message: string }
 | { type: "security-failed"; message: string }
 | { type: "security-ready" };
export const INITIAL_AUTH_FEEDBACK: AuthFeedbackState = { error: null, securityError: null };
export function authFeedbackReducer(state: AuthFeedbackState, event: AuthFeedbackEvent): AuthFeedbackState {
 switch(event.type) {
  case "submit": return INITIAL_AUTH_FEEDBACK;
  case "request-failed": return {...state,error:event.message};
  case "security-failed": return {...state,securityError:event.message};
  case "security-ready": return {...state,securityError:null};
 }
}
