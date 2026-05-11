import { createFileRoute } from "@tanstack/react-router";
import { AnvlApp } from "@/components/anvl/AnvlApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anvl AI — Visual IDE for Telegram & Max bots" },
      {
        name: "description",
        content:
          "Anvl AI is a visual constructor and code generator for Telegram and Max Messenger bots and mini-apps. Build flows, design Mini Apps, and deploy in minutes.",
      },
      { property: "og:title", content: "Anvl AI — Build bots for Telegram & Max" },
      {
        property: "og:description",
        content:
          "A high-fidelity visual IDE for designing and shipping bots and mini-apps across Telegram and Max simultaneously.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <AnvlApp autoCreate />;
}
