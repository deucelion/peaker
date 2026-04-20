export interface InjuryNoteAsset {
  path: string;
  signedUrl: string;
}

export interface AthleteInjuryNoteRecord {
  id: string;
  organizationId: string;
  athleteId: string;
  createdBy: string;
  createdByName: string;
  injuryType: string;
  note: string;
  assets: InjuryNoteAsset[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
