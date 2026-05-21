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
  [normalizeStudentName('Barbara Weinstein')]: require('../../assets/fotos/Barbara Weinstein.jpeg'),
  [normalizeStudentName('Cahique Benfeitas')]: require('../../assets/fotos/Cahique Benfeitas.jpeg'),
  [normalizeStudentName('Carla Vignoli')]: require('../../assets/fotos/Carla Vignoli.jpeg'),
  [normalizeStudentName('Cristiane Morais')]: require('../../assets/fotos/Cristiane Morais.jpeg'),
  [normalizeStudentName('Dante Cid')]: require('../../assets/fotos/Dante Cid.jpeg'),
  [normalizeStudentName('Eros Carneiro')]: require('../../assets/fotos/Eros Carneiro.jpeg'),
  [normalizeStudentName('Gabriel Borges')]: require('../../assets/fotos/Gabriel Borges.jpeg'),
  [normalizeStudentName('Gabriela Perez')]: require('../../assets/fotos/Gabriela Perez.jpeg'),
  [normalizeStudentName('Gregorio Rodrigues')]: require('../../assets/fotos/Gregorio Rodrigues.jpeg'),
  [normalizeStudentName('Ingrid Lucio')]: require('../../assets/fotos/Ingrid Lucio.jpeg'),
  [normalizeStudentName('Italo Valu')]: require('../../assets/fotos/Italo Valu.jpeg'),
  [normalizeStudentName('Jose Geraldo')]: require('../../assets/fotos/Jose Geraldo.png'),
  [normalizeStudentName('Luciana Miranda')]: require('../../assets/fotos/Luciana Miranda.jpeg'),
  [normalizeStudentName('Luiza Paim')]: require('../../assets/fotos/Luiza Paim.jpeg'),
  [normalizeStudentName('Marcela Norfini')]: require('../../assets/fotos/Marcela Norfini.jpeg'),
  [normalizeStudentName('Marianna Lucciola')]: require('../../assets/fotos/Marianna Lucciola.jpeg'),
  [normalizeStudentName('Milie Castro')]: require('../../assets/fotos/Milie Castro.jpeg'),
  [normalizeStudentName('Thais Vasconcelos')]: require('../../assets/fotos/Thais Vasconcelos.jpeg'),
  [normalizeStudentName('Thamirez Rodrigues')]: require('../../assets/fotos/Thamirez Rodrigues.jpeg'),
  [normalizeStudentName('Thereza Cid')]: require('../../assets/fotos/Thereza Cid.jpeg'),
  [normalizeStudentName('Vinicius Mol')]: require('../../assets/fotos/Vinicius Mol.jpeg'),
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
