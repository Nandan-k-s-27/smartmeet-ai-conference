import { redirect } from "next/navigation";

type MeetingPageProps = {
  params: Promise<{
    meetingId: string;
  }>;
};

export default async function MeetingIdPage({ params }: MeetingPageProps) {
  const { meetingId } = await params;

  redirect(`/dashboard?meetingId=${encodeURIComponent(meetingId)}`);
}
