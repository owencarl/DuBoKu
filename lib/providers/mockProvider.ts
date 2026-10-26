import { BaseMediaProvider } from './baseProvider';
import { MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

export class MockMediaProvider implements BaseMediaProvider {
  private items: MediaDetail[] = [
    {
      id: 'cdrama-hidden-love',
      title: 'Hidden Love (偷偷藏不住)',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1200&auto=format&fit=crop&q=80',
      status: 'Completed (25 Ep)',
      rating: 9.6,
      year: '2023',
      category: 'Chinese Drama',
      description: 'Sang Zhi falls in love with Duan Jiaxu, the boy who often comes to her house to play games in her older brother’s room. Years later, they reunite when she enters university.',
      tags: ['Romance', 'Youth', 'Drama', 'School'],
      actors: ['Zhao Lusi', 'Chen Zheyuan', 'Victor Ma', 'Zeng Li'],
      director: 'Lee Ching Jung',
      releaseDate: '2023-06-20',
      episodes: [
        { id: 'ep-hl-1', title: 'Episode 1: The First Encounter', number: 1, duration: '45m' },
        { id: 'ep-hl-2', title: 'Episode 2: Secret Wish', number: 2, duration: '47m' },
        { id: 'ep-hl-3', title: 'Episode 3: Sweet Graduation', number: 3, duration: '44m' },
        { id: 'ep-hl-4', title: 'Episode 4: University Reunion', number: 4, duration: '46m' },
        { id: 'ep-hl-5', title: 'Episode 5: Unspoken Feelings', number: 5, duration: '45m' },
      ],
    },
    {
      id: 'cdrama-till-the-end-of-the-moon',
      title: 'Till The End Of The Moon (长月烬明)',
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
      status: 'Completed (40 Ep)',
      rating: 9.4,
      year: '2023',
      category: 'Chinese Drama',
      description: 'In an era when demons rule supreme, the daughter of the Hengyang Sect travels 500 years back in time to prevent the Demon God from resurrecting.',
      tags: ['Xianxia', 'Romance', 'Fantasy', 'Mythology'],
      actors: ['Luo Yunxi', 'Bai Lu', 'Chen Duling', 'Deng Wei'],
      director: 'Kuk Kok-leung',
      releaseDate: '2023-04-06',
      episodes: [
        { id: 'ep-moon-1', title: 'Episode 1: The Five-Hundred Year Quest', number: 1, duration: '48m' },
        { id: 'ep-moon-2', title: 'Episode 2: Captive Prince', number: 2, duration: '46m' },
        { id: 'ep-moon-3', title: 'Episode 3: The Demon Awakening', number: 3, duration: '49m' },
      ],
    },
    {
      id: 'kdrama-queen-of-tears',
      title: 'Queen of Tears (눈물의 여왕)',
      poster: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&auto=format&fit=crop&q=80',
      status: 'Completed (16 Ep)',
      rating: 9.8,
      year: '2024',
      category: 'Korean Drama',
      description: 'The queen of department stores and her small-town husband weather a marital crisis until love miraculously begins to bloom again.',
      tags: ['Romance', 'Melodrama', 'Family', 'Comedy'],
      actors: ['Kim Soo-hyun', 'Kim Ji-won', 'Park Sung-hoon', 'Kwak Dong-yeon'],
      director: 'Jang Young-woo, Kim Hee-won',
      releaseDate: '2024-03-09',
      episodes: [
        { id: 'ep-qot-1', title: 'Episode 1: The Wedding of the Century', number: 1, duration: '75m' },
        { id: 'ep-qot-2', title: 'Episode 2: A Change of Heart', number: 2, duration: '78m' },
        { id: 'ep-qot-3', title: 'Episode 3: The Secret in Yongdu-ri', number: 3, duration: '82m' },
      ],
    },
    {
      id: 'kdrama-crash-landing',
      title: 'Crash Landing on You (사랑의 불시착)',
      poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
      status: 'Completed (16 Ep)',
      rating: 9.7,
      year: '2019',
      category: 'Korean Drama',
      description: 'A paragliding mishap drops a South Korean heiress into North Korea - and into the life of an army officer who decides he will help her hide.',
      tags: ['Romance', 'Military', 'Comedy', 'Adventure'],
      actors: ['Hyun Bin', 'Son Ye-jin', 'Seo Ji-hye', 'Kim Jung-hyun'],
      director: 'Lee Jung-hyo',
      releaseDate: '2019-12-14',
      episodes: [
        { id: 'ep-cloy-1', title: 'Episode 1: Over the Border', number: 1, duration: '70m' },
        { id: 'ep-cloy-2', title: 'Episode 2: The Village Guest', number: 2, duration: '72m' },
      ],
    },
    {
      id: 'movie-cyber-odyssey',
      title: 'Neon Horizon: 2099',
      poster: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
      status: '4K Ultra HD',
      rating: 9.1,
      year: '2024',
      category: 'Movies',
      description: 'A detective in Neo-Tokyo traces an encrypted rogue signal that controls cybernetic memory banks across the orbital metropolis.',
      tags: ['Sci-Fi', 'Action', 'Cyberpunk', 'Thriller'],
      actors: ['Ken Watanabe', 'Hiroyuki Sanada', 'Rinko Kikuchi'],
      director: 'Shinichiro Watanabe',
      releaseDate: '2024-01-15',
      episodes: [
        { id: 'ep-nh-full', title: 'Full Feature (4K)', number: 1, duration: '2h 14m' },
      ],
    },
    {
      id: 'anime-frieren',
      title: 'Frieren: Beyond Journey’s End (葬送のフリーレン)',
      poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
      backdrop: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
      status: 'Completed (28 Ep)',
      rating: 9.9,
      year: '2023',
      category: 'Anime',
      description: 'An elf mage and her companions defeat the Demon King. As her mortal friends age and pass away, she begins a new journey to understand humanity.',
      tags: ['Fantasy', 'Adventure', 'Drama', 'Magic'],
      actors: ['Atsumi Tanezaki', 'Nobuhiko Okamoto', 'Hiroki Touchi'],
      director: 'Keiichiro Saito',
      releaseDate: '2023-09-29',
      episodes: [
        { id: 'ep-frieren-1', title: 'Episode 1: The Journey’s End', number: 1, duration: '24m' },
        { id: 'ep-frieren-2', title: 'Episode 2: It Didn’t Have to Be Magic', number: 2, duration: '24m' },
        { id: 'ep-frieren-3', title: 'Episode 3: Killing Magic', number: 3, duration: '24m' },
      ],
    },
  ];

  // Public reliable test HLS streams
  private sampleStreams = [
    'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  ];

  async search(query: string): Promise<MediaItem[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.items;
    return this.items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q)) ||
        item.actors?.some((a) => a.toLowerCase().includes(q))
    );
  }

  async getFeatured(): Promise<MediaCategory[]> {
    return [
      {
        id: 'trending',
        title: '🔥 Trending Now',
        items: this.items.slice(0, 4),
      },
      {
        id: 'cdrama',
        title: '🎋 Chinese Dramas (国产剧)',
        items: this.items.filter((i) => i.category === 'Chinese Drama'),
      },
      {
        id: 'kdrama',
        title: '🌸 Korean & Japanese Dramas',
        items: this.items.filter((i) => i.category === 'Korean Drama'),
      },
      {
        id: 'movies',
        title: '🎬 Blockbuster Movies & Sci-Fi',
        items: this.items.filter((i) => i.category === 'Movies'),
      },
      {
        id: 'anime',
        title: '⚡ Popular Anime',
        items: this.items.filter((i) => i.category === 'Anime'),
      },
    ];
  }

  async getDetails(id: string): Promise<MediaDetail> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error(`Media not found: ${id}`);
    }
    return item;
  }

  async resolveStreamUrl(episodeId: string): Promise<StreamResolution> {
    // Determine stream deterministically or return test stream
    const index = Math.abs(episodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % this.sampleStreams.length;
    const streamUrl = this.sampleStreams[index];

    return {
      streamUrl,
      fallbackProxyUrl: `/api/proxy?url=${encodeURIComponent(streamUrl)}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      },
      format: 'hls',
    };
  }
}

export const defaultProvider = new MockMediaProvider();
