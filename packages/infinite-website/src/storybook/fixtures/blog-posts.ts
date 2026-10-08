import type { BlogPostSummary } from "../../blog/blog-contracts";

const covers = [
	"https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&h=900&fit=crop",
	"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&h=900&fit=crop",
	"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=1200&h=900&fit=crop",
];

const titles = [
	"Getting Started: A Complete Beginner's Guide",
	"10 Tips to Boost Your Productivity This Year",
	"Behind the Scenes: How We Built Our Latest Feature",
	"The Future of Design: Trends to Watch in 2026",
	"Why Customer Feedback Is Your Greatest Asset",
	"A Deep Dive Into Modern Web Performance",
	"How to Build a Brand That Stands Out",
	"Lessons Learned From Scaling Our Team",
	"The Art of Writing Compelling Content",
];

const excerpts = [
	"Everything you need to know to hit the ground running. We cover the essentials so you can focus on what matters most.",
	"Small changes can make a big difference. Discover practical strategies that top performers use every day.",
	"A look at the process, challenges, and decisions that shaped our newest release from concept to launch.",
	"From AI-powered tools to bold new aesthetics, here's what's shaping the creative landscape this year.",
	"Learn how listening to your users can transform your product roadmap and drive meaningful growth.",
	"Performance isn't just a metric. It's a user experience, and every millisecond counts.",
	"Standing out in a crowded market starts with a clear identity. We break down the fundamentals.",
	"Growing a team is more than hiring. Here's what we learned about culture, process, and communication.",
	"Great content doesn't happen by accident. Explore the techniques behind writing that resonates.",
];

export const sampleBlogPosts: Array<BlogPostSummary> = titles.map((title, index) => ({
	coverAlt: title,
	coverImage: { src: covers[index % covers.length] ?? "" },
	excerpt: excerpts[index] ?? "",
	id: `sample-post-${index}`,
	publishedAt: new Date(Date.UTC(2026, 2, 28 - index * 3)).toISOString(),
	slug: `sample-post-${index}`,
	title,
}));
