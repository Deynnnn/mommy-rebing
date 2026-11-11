export type MediaType = "image" | "video";

export type PublicPost = {
  id: string;
  name: string | null;
  message: string | null;
  createdAt: string;
  mediaType: MediaType;
};
