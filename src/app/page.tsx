import { redirect } from "next/navigation";

// "Today" is the real home screen; the sidebar covers every other module.
export default function Home() {
  redirect("/today");
}
