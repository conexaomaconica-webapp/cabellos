export type AssetType =
  | 'logo_primary'
  | 'logo_compact'
  | 'favicon'
  | 'splash_video'
  | 'splash_image';

export type CategoryGroup = 'logo_primary' | 'logo_compact' | 'favicon' | 'splash';

export interface SystemAsset {
  id: string;
  asset_type: AssetType;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  activated_by: string | null;
  activated_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  public_url?: string;
}

export interface SystemBranding {
  logo_primary: {
    id: string;
    storage_path: string;
    mime_type: string;
    public_url?: string;
    height?: number | null;
  } | null;
  logo_compact: {
    id: string;
    storage_path: string;
    mime_type: string;
    public_url?: string;
    height?: number | null;
  } | null;
  favicon: {
    id: string;
    storage_path: string;
    public_url?: string;
  } | null;
  splash: {
    id: string;
    asset_type: AssetType;
    storage_path: string;
    mime_type: string;
    public_url?: string;
  } | null;
}
