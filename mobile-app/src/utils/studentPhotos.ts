import type { ImageSourcePropType } from 'react-native';
import { getApiBaseUrl } from '../services/api';

type StudentLike = {
  name?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  profilePhoto?: string | null;
  imageUrl?: string | null;
  picture?: string | null;
  photo?: string | null;
  avatar?: string | null;
};

const localStudentPhotos: Record<string, ImageSourcePropType> = {
  [normalizeStudentName('Eros Carneiro')]: require('../../assets/fotos/Eros Carneiro.jpeg'),
};

export function normalizeStudentName(name?: string | null) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function initialsFromStudentName(name?: string | null) {
  const parts = String(name || 'Aluno').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function resolveRemoteStudentPhotoUri(entity?: StudentLike | null) {
  const raw = [
    entity?.photoUrl,
    entity?.avatarUrl,
    entity?.profilePhoto,
    entity?.imageUrl,
    entity?.picture,
    entity?.photo,
    entity?.avatar,
  ].find((value) => typeof value === 'string' && value.trim().length > 0);

  if (!raw) return null;

  const value = String(raw).trim();
  if (/^(https?:|data:|file:|content:)/i.test(value)) return value;

  const apiRoot = getApiBaseUrl().replace(/\/api\/?$/i, '').replace(/\/$/, '');
  if (value.startsWith('/')) return `${apiRoot}${value}`;
  return `${apiRoot}/${value}`;
}

export function getLocalStudentPhotoSource(name?: string | null) {
  return localStudentPhotos[normalizeStudentName(name)] || null;
}

export function getStudentPhotoSource(entity?: StudentLike | null): ImageSourcePropType | null {
  const remoteUri = resolveRemoteStudentPhotoUri(entity);
  if (remoteUri) return { uri: remoteUri };
  return getLocalStudentPhotoSource(entity?.name);
}
