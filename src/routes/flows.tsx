import { createFileRoute } from "@tanstack/react-router";
import { FlowsList } from "@/components/anvl/FlowsList";

export const Route = createFileRoute("/flows")({
  head: () => ({
    meta: [
      { title: "Your flows — ANVL" },
      { name: "description", content: "All your saved bot workspaces in ANVL." },
      { property: "og:title", content: "Your flows — ANVL" },
      { property: "og:description", content: "Manage all your Telegram and Max bot workspaces." },
    ],
  }),
  component: FlowsList,
});
