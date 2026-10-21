import {redirect} from "next/navigation";

/** Old invitation URLs continue into the regular dashboard flow. */
export default function RetiredPasswordSetup(){redirect("/dashboard");}
