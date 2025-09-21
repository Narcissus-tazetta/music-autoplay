export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const channelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;
export const shortUrl = (id: string) => `https://youtu.be/${id}`;
export const searchUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

export default {
    watchUrl,
    channelUrl,
    shortUrl,
    searchUrl,
};
