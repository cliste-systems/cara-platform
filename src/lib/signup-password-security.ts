import "server-only";
import { createHash } from "node:crypto";

/** Admin user creation may bypass Auth's public signup password policy. Only a
 * five-character SHA-1 prefix leaves the server; never send or log the password. */
export async function checkSignupPassword(password: string): Promise<{ok:true}|{ok:false;message:string}> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`, {
      headers: {"Add-Padding":"true"}, signal: AbortSignal.timeout(5000), cache:"no-store",
    });
    if (!response.ok) throw new Error("Password check unavailable");
    const lines = (await response.text()).split(/\r?\n/);
    if (!lines.some(line => /^[A-F0-9]{35}:\d+$/.test(line))) throw new Error("Invalid password check response");
    if (lines.some(line => {const [suffix,count]=line.split(":");return suffix===hash.slice(5)&&Number(count)>0;})) return {ok:false,message:"This password has appeared in a data breach. Choose a unique password."};
    return {ok:true};
  } catch {
    return {ok:false,message:"We couldn’t check your password securely. Please try again shortly."};
  }
}
