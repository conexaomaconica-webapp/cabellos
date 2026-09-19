'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  uploadSystemAssetAction,
  activateSystemAssetAction,
  deactivateSplashAction,
  archiveSystemAssetAction,
  deleteSystemAssetAction,
  updateSystemAssetHeightAction,
} from '@/lib/master/system-assets';
import { SystemAsset, AssetType, SystemBranding } from '@/types/system-assets';
import BrandLogo from '@/components/shared/BrandLogo';
import {
  Upload,
  CheckCircle2,
  Archive,
  Eye,
  Video,
  Image as ImageIcon,
  Crown,
  Monitor,
  Smartphone,
  Play,
  XCircle,
} from 'lucide-react';

export default function SystemIdentityClientView({
  initialAssets,
  initialBranding,
}: {
  initialAssets: SystemAsset[];
  initialBranding: SystemBranding;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'logos' | 'splash' | 'preview' | 'history'>('logos');
  const [uploadType, setUploadType] = useState<AssetType>('logo_primary');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [primaryHeight, setPrimaryHeight] = useState(initialBranding?.logo_primary?.height || 32);
  const [compactHeight, setCompactHeight] = useState(initialBranding?.logo_compact?.height || 32);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('asset_type', uploadType);

      await uploadSystemAssetAction(formData);
      setSelectedFile(null);
      alert('Ativo enviado com sucesso!');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao enviar ativo.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (assetId: string) => {
    setLoading(true);
    try {
      await activateSystemAssetAction(assetId);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao ativar ativo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateSplash = async () => {
    setLoading(true);
    try {
      await deactivateSplashAction();
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao desativar Splash Screen.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (assetId: string) => {
    setLoading(true);
    try {
      await archiveSystemAssetAction(assetId);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao arquivar ativo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este ativo? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      await deleteSystemAssetAction(assetId);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao excluir ativo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHeight = async (assetId: string, height: number) => {
    setLoading(true);
    try {
      await updateSystemAssetHeightAction(assetId, height);
      alert('Tamanho atualizado com sucesso!');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar o tamanho.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => {
            setActiveTab('logos');
            setUploadType('logo_primary');
            setSelectedFile(null);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'logos'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ImageIcon className="h-4 w-4" /> Logos & Favicon
        </button>

        <button
          onClick={() => {
            setActiveTab('splash');
            setUploadType('splash_video');
            setSelectedFile(null);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'splash'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Video className="h-4 w-4" /> Mídia de Abertura / Splash
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'preview'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Eye className="h-4 w-4" /> Pré-Visualização
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Crown className="h-4 w-4" /> Histórico de Versões
        </button>
      </div>

      {/* ABA 1: LOGOS & FAVICON */}
      {activeTab === 'logos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* UPLOAD CARD */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-400" /> Enviar Nova Logo ou Favicon
            </h2>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Tipo de Ativo</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as AssetType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 outline-none"
                >
                  <option value="logo_primary">Logo Principal (SVG, PNG, WebP)</option>
                  <option value="logo_compact">Logo Compacta (SVG, PNG, WebP)</option>
                  <option value="favicon">Favicon (ICO, PNG, SVG)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Selecionar Arquivo (Max 2MB)</label>
                <input
                  type="file"
                  required
                  accept={
                    uploadType === 'favicon'
                      ? 'image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml'
                      : 'image/svg+xml,image/png,image/webp'
                  }
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-950/60 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Fazer Upload'}
              </button>
            </form>
          </div>

          {/* ATIVOS ATIVOS ATUAIS */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Ativos Ativos no Sistema
            </h2>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[11px]">Logo Principal</span>
                    <div className="mt-2 p-2 bg-slate-900/50 rounded-lg inline-block">
                      <BrandLogo 
                        type="primary" 
                        srcUrl={initialBranding?.logo_primary?.public_url} 
                        height={primaryHeight}
                        className="h-8" 
                      />
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> VIGENTE
                  </span>
                </div>
                {initialBranding?.logo_primary && (
                  <div className="flex items-center gap-4 pt-3 border-t border-slate-800/60">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <label className="text-slate-400 text-[10px] font-bold uppercase">Ajustar Tamanho (Altura)</label>
                        <span className="text-purple-400 font-bold">{primaryHeight}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="20" max="120" step="4" 
                        value={primaryHeight} 
                        onChange={(e) => setPrimaryHeight(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <button 
                      onClick={() => handleSaveHeight(initialBranding.logo_primary!.id, primaryHeight)}
                      disabled={loading || primaryHeight === initialBranding.logo_primary.height}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
                    >
                      Salvar Tamanho
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[11px]">Logo Compacta</span>
                    <div className="mt-2 p-2 bg-slate-900/50 rounded-lg inline-block">
                      <BrandLogo 
                        type="compact" 
                        srcUrl={initialBranding?.logo_compact?.public_url} 
                        height={compactHeight}
                        className="h-8" 
                      />
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> VIGENTE
                  </span>
                </div>
                {initialBranding?.logo_compact && (
                  <div className="flex items-center gap-4 pt-3 border-t border-slate-800/60">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <label className="text-slate-400 text-[10px] font-bold uppercase">Ajustar Tamanho (Altura)</label>
                        <span className="text-purple-400 font-bold">{compactHeight}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="16" max="80" step="2" 
                        value={compactHeight} 
                        onChange={(e) => setCompactHeight(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <button 
                      onClick={() => handleSaveHeight(initialBranding.logo_compact!.id, compactHeight)}
                      disabled={loading || compactHeight === initialBranding.logo_compact.height}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
                    >
                      Salvar Tamanho
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: SPLASH SCREEN */}
      {activeTab === 'splash' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-400" /> Enviar Vídeo ou Imagem de Splash
            </h2>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Formato de Mídia</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as AssetType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 outline-none"
                >
                  <option value="splash_video">Vídeo MP4 / WebM (~3s, Max 10MB)</option>
                  <option value="splash_image">Imagem PNG / WebP / JPEG (Max 10MB)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Selecionar Mídia (Max 10MB)</label>
                <input
                  type="file"
                  required
                  accept={uploadType === 'splash_video' ? 'video/mp4,video/webm' : 'image/png,image/webp,image/jpeg'}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-950/60 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Fazer Upload Mídia Splash'}
              </button>
            </form>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Video className="h-5 w-5 text-emerald-400" /> Splash Screen Atual
              </h2>
              {initialBranding?.splash && (
                <button
                  onClick={handleDeactivateSplash}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <XCircle className="h-4 w-4" /> Desativar Splash
                </button>
              )}
            </div>

            {initialBranding?.splash ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-purple-300 uppercase">
                  Mídia Ativa ({initialBranding.splash.asset_type})
                </span>
                {initialBranding.splash.asset_type === 'splash_video' ? (
                  <video controls className="w-full max-h-48 rounded-lg object-contain bg-black">
                    <source src={initialBranding.splash.public_url} type={initialBranding.splash.mime_type} />
                  </video>
                ) : (
                  <img
                    src={initialBranding.splash.public_url}
                    alt="Splash Ativa"
                    className="w-full max-h-48 rounded-lg object-contain bg-black"
                  />
                )}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                Nenhum Splash ativo. O sistema exibe a logo oficial em animação padrão de fallback.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: PRÉ-VISUALIZAÇÃO MULTI-DISPOSITIVO */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DESKTOP SIDEBAR PREVIEW */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="h-4 w-4 text-purple-400" /> Preview na Sidebar Desktop
              </h3>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                <BrandLogo type="primary" srcUrl={initialBranding?.logo_primary?.public_url} height={initialBranding?.logo_primary?.height} className="h-8" />
              </div>
            </div>

            {/* MOBILE HEADER PREVIEW */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-purple-400" /> Preview Header Mobile (Compacta)
              </h3>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <BrandLogo type="compact" srcUrl={initialBranding?.logo_compact?.public_url} height={initialBranding?.logo_compact?.height} className="h-8" />
                <span className="text-xs text-slate-500">Menu ☰</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: HISTÓRICO DE ATIVOS */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Arquivo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Data Upload</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {initialAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors text-xs">
                    <td className="px-6 py-4 font-bold text-purple-300 uppercase">{asset.asset_type}</td>
                    <td className="px-6 py-4 text-slate-300">{asset.file_name || asset.storage_path}</td>
                    <td className="px-6 py-4">
                      {asset.is_active && !asset.archived_at ? (
                        <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          VIGENTE
                        </span>
                      ) : asset.archived_at ? (
                        <span className="px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-500">
                          ARQUIVADO
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400">
                          INATIVO
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!asset.is_active && !asset.archived_at && (
                        <button
                          onClick={() => handleActivate(asset.id)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                        >
                          Ativar
                        </button>
                      )}
                      {!asset.is_active && !asset.archived_at && (
                        <button
                          onClick={() => handleArchive(asset.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                        >
                          Arquivar
                        </button>
                      )}
                      {!asset.is_active && (
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 font-bold border border-red-900/30"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
