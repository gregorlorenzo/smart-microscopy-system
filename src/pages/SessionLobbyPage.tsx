import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Link2, Library, Play, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadSessionInfo, buildJoinUrl, clearSessionInfo } from '@/lib/sessionUtils';
import { useSessionPresence } from '@/hooks/useSessionPresence';
import { SessionInfo } from '@/types/session';

export default function SessionLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Load session info from sessionStorage on mount.
  // If not found (e.g. someone navigated directly to this URL), redirect to landing.
  useEffect(() => {
    const info = loadSessionInfo();
    if (!info || info.code !== code?.toUpperCase()) {
      navigate('/');
      return;
    }
    setSessionInfo(info);
  }, [code, navigate]);

  const { participants, resolvedSessionName } = useSessionPresence({
    sessionCode: sessionInfo ? (code || '') : '',
    participantName: sessionInfo?.participantName || '',
    role: sessionInfo?.role || 'viewer',
    sessionName: sessionInfo?.role === 'presenter' ? sessionInfo.name : undefined,
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code || '');
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildJoinUrl(code || ''));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleStartOrJoinStream = () => navigate(`/session/${code}/stream`);
  const handleOpenLibrary = () => navigate(`/session/${code}/library`);

  const handleLeave = () => {
    clearSessionInfo();
    navigate('/');
  };

  // Don't render until session info is loaded (avoids flash before redirect)
  if (!sessionInfo) return null;

  const isPresenter = sessionInfo.role === 'presenter';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md space-y-6">

        {/* Header: session name + leave button */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{resolvedSessionName}</h1>
              {isPresenter && (
                <Badge className="bg-gray-900 text-white text-xs px-2 py-0.5">Presenter</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Session Code: <span className="font-mono font-semibold">{code}</span></p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600 gap-1.5 -mt-1"
            onClick={handleLeave}
          >
            <ArrowLeft className="w-4 h-4" />
            Leave
          </Button>
        </div>

        {/* Copy / share buttons — presenter only */}
        {isPresenter && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyCode}
            >
              <Copy className="w-4 h-4" />
              {codeCopied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
            >
              <Link2 className="w-4 h-4" />
              {linkCopied ? 'Copied!' : 'Share Link'}
            </Button>
          </div>
        )}

        {/* Participant list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Participants ({participants.length})
          </h2>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">
                {isPresenter
                  ? 'Waiting for participants to join...'
                  : 'Connecting to session...'}
              </p>
            ) : (
              participants.map((p) => {
                const isYou = p.name === sessionInfo.participantName;
                return (
                  <div
                    key={p.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isYou
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {isYou ? `${p.name} (You)` : p.name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{p.role}</p>
                      </div>
                    </div>
                    {p.role === 'presenter' && (
                      <span className="text-yellow-500 text-lg" title="Presenter">★</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={handleStartOrJoinStream}
          >
            <Play className="w-4 h-4" />
            {isPresenter ? 'Start Microscope Stream' : 'Join Stream'}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenLibrary}
          >
            <Library className="w-4 h-4" />
            Specimen Library
          </Button>
        </div>
      </div>
    </div>
  );
}
