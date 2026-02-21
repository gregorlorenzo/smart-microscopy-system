import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { generateSessionCode, saveSessionInfo, buildJoinUrl } from '@/lib/sessionUtils';

export default function SessionLandingPage() {
  const navigate = useNavigate();

  // Dialog visibility
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create session form state
  const [sessionName, setSessionName] = useState('');
  // Generate code once on mount (useState initializer runs once)
  const [generatedCode] = useState(generateSessionCode);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Join session form state
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildJoinUrl(generatedCode));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCreateSession = () => {
    if (!sessionName.trim()) return;
    saveSessionInfo({
      code: generatedCode,
      name: sessionName.trim(),
      participantName: 'Presenter',
      role: 'presenter',
    });
    navigate(`/session/${generatedCode}`);
  };

  const handleJoinSession = () => {
    setJoinError('');
    if (!joinName.trim()) {
      setJoinError('Please enter your name');
      return;
    }
    if (joinCode.trim().length !== 6) {
      setJoinError('Session code must be 6 characters');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    saveSessionInfo({
      code,
      name: code, // Will be overwritten once presenter's presence data arrives
      participantName: joinName.trim(),
      role: 'viewer',
    });
    navigate(`/session/${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <Microscope className="w-7 h-7 text-blue-500" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">MicroScope Share</h1>
          <p className="text-gray-500 text-sm">Share live microscope views with your team</p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button className="w-full gap-2" onClick={() => setShowCreate(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Create Session
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setShowJoin(true)}>
            Join Session
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          Collaborate in real-time with remote observation and annotation tools
        </p>

        <a
          href="/standalone"
          className="block text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Use standalone mode →
        </a>
      </div>

      {/* ── Create Session Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Set up your microscope sharing session and invite participants
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                placeholder="e.g., Biology Lab Session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Session Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="bg-gray-50 font-mono font-bold tracking-widest text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  title="Copy code"
                >
                  {codeCopied ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Share Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={buildJoinUrl(generatedCode)}
                  readOnly
                  className="bg-gray-50 text-xs text-gray-500"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  title={linkCopied ? 'Copied!' : 'Copy link'}
                >
                  {linkCopied ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateSession}
                disabled={!sessionName.trim()}
              >
                Create Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join Session Dialog ── */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Session</DialogTitle>
            <DialogDescription>
              Enter the session code to join an existing microscope session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="your-name">Your Name</Label>
              <Input
                id="your-name"
                placeholder="Enter your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join-code">Session Code</Label>
              <Input
                id="join-code"
                placeholder="e.g., ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest uppercase text-center"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              />
              {joinError && <p className="text-sm text-red-500">{joinError}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowJoin(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleJoinSession}>
                Join Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
