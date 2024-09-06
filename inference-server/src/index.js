import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { events } from 'fetch-event-stream';

const app = new Hono();

app.get('/', async(c) => {
	return c.html(`<html>
	<head>
		<title>Admin Panel</title>
	</head>
	<body>
		
	</body>
	</html>`);
})


// New function to generate a lofi music clip using Hugging Face Inference API
async function generateLofiClip(env, prompt) {
	const API_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-small";
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.HUGGINGFACE_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ inputs: prompt })
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
	}

	return new Uint8Array(await response.arrayBuffer());
}

// Array of prompts for different lofi vibes
const lofiPrompts = [
	"Calm and relaxing lofi beat with soft piano and gentle rain sounds",
	"Upbeat lofi hip-hop with jazzy guitar and vinyl crackle",
	"Dreamy lofi atmosphere with synth pads and bird chirps",
	"Chill lofi groove with mellow bass and coffee shop ambience",
	"Nostalgic lofi melody with retro game sounds and soft strings"
];

// Function to generate and cache a single lofi clip
async function generateAndCacheLofiClip(env, index) {
	const prompt = lofiPrompts[index];
	const clipKey = `lofi_clip_${index}`;

	try {
		const audioData = await generateLofiClip(env, prompt);
		if (audioData.length === 0) {
			throw new Error('Received empty audio data');
		}
		await env.LOFI_CACHE.put(clipKey, audioData, { expirationTtl: 86400 }); // Cache for 24 hours
		console.log(`Generated and cached lofi clip: ${clipKey}`);
	} catch (error) {
		console.error(`Error generating lofi clip: ${clipKey}`, error.message);
		// You might want to implement a retry mechanism or alert system here
	}
}

// New route to get a random lofi clip
app.get('/lofi', async (c) => {
	const clipIndex = Math.floor(Math.random() * lofiPrompts.length);
	const clipKey = `lofi_clip_${clipIndex}`;
	
	let audioData = await c.env.LOFI_CACHE.get(clipKey, 'arrayBuffer');

	if (!audioData) {
		// If the clip doesn't exist, generate it
		await generateAndCacheLofiClip(c.env, clipIndex);
		audioData = await c.env.LOFI_CACHE.get(clipKey, 'arrayBuffer');
	}

	if (!audioData) {
		return c.text('Failed to generate lofi clip', 500);
	}

	return new Response(audioData, {
		headers: {
			'Content-Type': 'audio/wav',
			'Content-Disposition': 'attachment; filename="lofi_clip.wav"'
		}
	});
});

// Scheduled task to generate lofi clips (to be set up in Cloudflare dashboard)
app.get('/generate-lofi', async (c) => {
	const index = Math.floor(Math.random() * lofiPrompts.length);
	await generateAndCacheLofiClip(c.env, index);
	return c.text('Lofi clip generated and cached');
});

export default app;
