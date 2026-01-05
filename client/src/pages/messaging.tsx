import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MessagingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-gray-400 mt-2">Chat with other users in real-time</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">The messaging feature is currently under development.</p>
        </CardContent>
      </Card>
    </div>
  );
}
