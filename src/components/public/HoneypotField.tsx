import { HONEYPOT_FIELD } from "@/lib/publicFormGuard";

// Decoy input for spam bots — see publicFormGuard.ts. Moved off-screen
// rather than display:none, since some bots skip hidden inputs. Keyboard
// and screen-reader users never reach it (tabIndex -1, aria-hidden).
export default function HoneypotField() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
      <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
