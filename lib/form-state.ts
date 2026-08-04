// What an intake form action hands back to the page. On failure it carries the
// answers it read, so the form can render them again instead of losing them.
export interface FormState {
  error?: string;
  values?: Record<string, unknown>;
  attempt: number;
}

export const EMPTY_FORM_STATE: FormState = { attempt: 0 };
