import { MetadataRoute } from 'next';
import { fetchEvents } from '@/lib/events-seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.vetaas.in';

  // All publicly indexable routes. Primary nav destinations get the highest
  // priority so Google is more likely to surface them as sitelinks.
  const routes = [
    '',
    '/about',
    '/services',
    '/children',
    '/teachers',
    '/parents',
    '/events',
    '/find-us',
    '/contact',
    '/products',
    '/products/sel-assessment',
    '/products/parent-reflection',
    '/club',
    '/privacy',
    '/terms',
  ];

  // Top-level nav links — eligible for sitelinks.
  const primaryNav = ['/about', '/services', '/events', '/contact'];
  // Services dropdown + Find Us — secondary nav links.
  const secondaryNav = ['/children', '/teachers', '/parents', '/find-us'];

  // Each event now has its own page, which is what people share, so list them
  // too. A cancelled event is dropped by fetchEvents.
  const events = await fetchEvents();
  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${baseUrl}/events/${event.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const pages = routes.map((route) => {
    let priority = 0.8;
    let changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly';

    if (route === '') {
      priority = 1.0;
      changeFrequency = 'weekly';
    } else if (route === '/events') {
      priority = 0.9;
      changeFrequency = 'weekly';
    } else if (primaryNav.includes(route)) {
      priority = 0.9;
    } else if (secondaryNav.includes(route)) {
      priority = 0.7;
    } else if (['/privacy', '/terms'].includes(route)) {
      priority = 0.3; // Low priority to discourage sitelinks
      changeFrequency = 'yearly';
    }

    return {
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    };
  });

  return [...pages, ...eventPages];
}
