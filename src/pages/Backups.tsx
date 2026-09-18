import { useEffect, useState } from 'react';
import {
  Download,
  FileArchive,
  Database,
  FolderArchive,
  Clock,
  HardDrive,
  AlertCircle,
} from 'lucide-react';
import { supabase, type Backup } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, Badge, Spinner, EmptyState, Button } from '@/components/ui';
import { formatFileSize, formatDateTime } from '@/lib/format';

const typeConfig = {
  full: { icon: <FolderArchive className="w-5 h-5" />, label: 'Full Backup' },
  files: { icon: <FileArchive className="w-5 h-5" />, label: 'Files Only' },
  database: { icon: <Database className="w-5 h-5" />, label: 'Database' },
};

export function BackupsPage() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('backups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setBackups(data as Backup[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDownload = async (backup: Backup) => {
    setDownloading(backup.id);
    setError('');
    try {
      const { data, error: dlError } = await supabase.storage
        .from('backups')
        .createSignedUrl(backup.storage_path, 3600);

      if (dlError || !data) {
        throw new Error('Failed to generate download link');
      }

      // Open the signed URL
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
    } finally {
      setDownloading(null);
    }
  };

  const isExpired = (backup: Backup) => {
    if (!backup.expires_at) return false;
    return new Date(backup.expires_at) < new Date();
  };

  if (loading) return <Spinner className="py-20" />;

  const totalSize = backups.reduce((sum, b) => sum + b.file_size, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backups</h1>
        <p className="text-sm text-slate-500 mt-1">
          Download backup copies of your website files
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Available backups</span>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{backups.length}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total size</span>
            <FileArchive className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatFileSize(totalSize)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Latest backup</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {backups.length > 0 ? formatDateTime(backups[0].created_at) : '—'}
          </p>
        </Card>
      </div>

      {/* Backups list */}
      <Card>
        <CardHeader
          title="Downloadable Backups"
          subtitle="Click download to get a copy of your website files"
          icon={<Download className="w-5 h-5" />}
        />
        {backups.length === 0 ? (
          <EmptyState
            icon={<Download className="w-6 h-6" />}
            title="No backups available"
            description="Backup copies of your website will appear here when they are created."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((backup) => {
              const cfg = typeConfig[backup.backup_type] ?? typeConfig.full;
              const expired = isExpired(backup);
              return (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {cfg.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {backup.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-400">
                          {formatDateTime(backup.created_at)}
                        </p>
                        <span className="text-slate-300">•</span>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(backup.file_size)}
                        </p>
                        <Badge variant="neutral">{cfg.label}</Badge>
                        {expired && (
                          <Badge variant="danger">Expired</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={downloading === backup.id}
                    disabled={expired}
                    onClick={() => handleDownload(backup)}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
