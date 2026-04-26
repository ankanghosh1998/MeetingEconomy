import type { Meeting, MeetingAttendee } from "@meetingeconomy/db";
import type { SummaryInput } from "@meetingeconomy/types";
import { env, isConfigured } from "../config/env";

function list(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None provided";
}

function listActions(items: SummaryInput["action_items"]) {
  return items.length
    ? items
        .map((item) => `- ${item.owner ? `[${item.owner}] ` : ""}${item.task}${item.due_date ? ` by ${item.due_date}` : ""}`)
        .join("\n")
    : "- None provided";
}

export function buildSummaryPrompt(
  meeting: Pick<Meeting, "title" | "startTime" | "endTime">,
  attendees: Pick<MeetingAttendee, "name" | "email">[],
  input: SummaryInput
) {
  const attendeeNames = attendees.map((attendee) => attendee.name || attendee.email).join(", ");
  return `Meeting Title: ${meeting.title}
Date: ${meeting.startTime.toISOString()}
Duration: ${meeting.startTime.toISOString()} - ${meeting.endTime.toISOString()}
Attendees: ${attendeeNames || "No attendees listed"}

Key Discussion Points:
${list(input.key_points)}

Decisions:
${list(input.decisions)}

Action Items:
${listActions(input.action_items)}

Write a concise, clear meeting summary email to all attendees, including these points.`;
}

export function fallbackSummary(
  meeting: Pick<Meeting, "title" | "startTime" | "endTime">,
  attendees: Pick<MeetingAttendee, "name" | "email">[],
  input: SummaryInput
) {
  const subject = `Subject: ${meeting.title} - Summary and Action Items`;
  const names = attendees.map((attendee) => attendee.name || attendee.email);
  return `${subject}

Hi ${names.length ? "Team" : "there"},

Thank you for attending ${meeting.title}. Here is the meeting summary:

Key Points:
${list(input.key_points)}

Decisions:
${list(input.decisions)}

Action Items:
${listActions(input.action_items)}

Next Steps:
- Please review the action items and share updates with the group.

Thank you.`;
}

export async function generateMeetingSummary(input: {
  meeting: Pick<Meeting, "title" | "startTime" | "endTime">;
  attendees: Pick<MeetingAttendee, "name" | "email">[];
  notes: SummaryInput;
}) {
  if (!isConfigured(env.OPENAI_API_KEY)) {
    return fallbackSummary(input.meeting, input.attendees, input.notes);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: isConfigured(env.OPENAI_MODEL) ? env.OPENAI_MODEL : "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant specialized in writing professional meeting summaries and action item lists. Given structured meeting notes, draft a concise email-style Minutes of Meeting addressed to all attendees. Use a polite tone. Do not invent information beyond what is provided."
        },
        {
          role: "user",
          content: buildSummaryPrompt(input.meeting, input.attendees, input.notes)
        }
      ]
    })
  });

  if (!response.ok) {
    const fallback = fallbackSummary(input.meeting, input.attendees, input.notes);
    return `${fallback}

Note: OpenAI generation was unavailable, so MeetingEconomy used the local deterministic formatter.`;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || fallbackSummary(input.meeting, input.attendees, input.notes);
}
