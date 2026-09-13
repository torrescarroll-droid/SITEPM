import { askDemo, projectName } from "@/lib/demo-data";
import { Card, DemoNote } from "@/components/ui";

export function AskThread({ projectId }: { projectId?: string }) {
  const scopedId = projectId ?? askDemo.projectId;

  return (
    <div className="space-y-4">
      <DemoNote>
        Demo conversation only. Questions are scoped to {projectName(scopedId)}.
        No AI service is connected.
      </DemoNote>
      <div className="space-y-3">
        {askDemo.messages.map((message, index) => (
          <Card
            key={index}
            className={message.role === "user" ? "bg-stone-50" : ""}
          >
            <p className="text-xs font-medium tracking-[0.12em] text-stone-500 uppercase">
              {message.role === "user" ? "You" : "SITEPM"}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-800 md:text-base">
              {message.text}
            </p>
            {message.role === "sitepm" ? (
              <p className="mt-3 text-sm text-stone-500">
                {message.source
                  ? `Source: ${message.source}`
                  : "No source found in uploaded project documents."}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
      <form className="rounded-2xl border border-stone-200 bg-white p-3">
        <label className="sr-only" htmlFor="ask-input">
          Ask a project question
        </label>
        <textarea
          id="ask-input"
          rows={3}
          disabled
          placeholder="Ask about this project…"
          className="w-full resize-none bg-transparent text-sm text-stone-800 outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white opacity-60"
          >
            Ask SITEPM
          </button>
        </div>
      </form>
    </div>
  );
}
