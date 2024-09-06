import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

const app = new OpenAPIHono();

// Add CORS middleware
app.use('*', cors({
  origin: '*', // Be more specific in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Clip-Index'],
  maxAge: 600,
  credentials: true,
}))

// Use the hook method to set the Referrer-Policy header
app.use('*', async (c, next) => {
  c.header('Referrer-Policy', 'no-referrer-when-downgrade')
  await next()
})

app.get(
	'/',
	swaggerUI({
	  url: '/doc'
	})
  )
  
  app.doc('/doc', {
	info: {
	  title: 'An API',
	  version: 'v1'
	},
	openapi: '3.1.0'
  })

// OpenAPI route for getting a random lofi clip
app.openapi(
  createRoute({
    method: 'get',
    path: '/lofi',
    responses: {
      200: {
        description: 'Returns a random lofi music clip',
        content: {
          'audio/wav': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          }
        },
        headers: {
          'X-Clip-Index': {
            schema: { type: 'integer' },
            description: 'Index of the current clip'
          }
        }
      },
      500: {
        description: 'Failed to generate lofi clip',
        content: {
          'text/plain': {
            schema: {
              type: 'string'
            }
          }
        }
      }
    }
  }),
  async (c) => {
    try {
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

      const response = new Response(audioData, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Disposition': 'attachment; filename="lofi_clip.wav"',
          'X-Clip-Index': clipIndex.toString()
        }
      });

      return response;
    } catch (error) {
      console.error('Error in /lofi endpoint:', error);
      return c.text('Internal server error', 500);
    }
  }
)

// OpenAPI route for generating a new lofi clip
app.openapi(
  createRoute({
    method: 'get',
    path: '/generate-lofi',
    responses: {
      200: {
        description: 'Generates and caches a new lofi clip',
        content: {
          'text/plain': {
            schema: {
              type: 'string'
            }
          }
        }
      }
    }
  }),
  async (c) => {
    // ... existing /generate-lofi route logic ...
  }
)

// Serve Swagger UI
app.get('/ui', swaggerUI({ url: '/doc' }))

// Serve OpenAPI documentation
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Lofi Music Generator API',
    version: '1.0.0',
    description: 'API for generating and serving lofi music clips'
  },
  servers: [
    {
      url: 'https://your-worker-url.workers.dev',
      description: 'Production server'
    }
  ]
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
	"Create a futuristic lo-fi beat that blends modern electronic elements with synthwave influences. Incorporate smooth, atmospheric synths and gentle, relaxing rhythms to evoke a sense of a serene, neon-lit future. Ensure  the track is continuous with no background noise or interruptions, maintaining a calm and tranquil atmosphere throughout while adding a touch of retro-futuristic vibes.",
    "gentle lo-fi beat with a smooth, mellow piano melody in the background. Ensure there are no background noises or interruptions, maintaining a continuous and seamless flow throughout the track. The beat should be relaxing and tranquil, perfect for a calm and reflective atmosphere.",
    "Create an earthy lo-fi beat that evokes a natural, grounded atmosphere. Incorporate organic sounds like soft percussion, rustling leaves, and gentle acoustic instruments. The track should have a warm, soothing rhythm with a continuous flow and no background noise or interruptions, maintaining a calm and reflective ambiance throughout.",
    "Create a soothing lo-fi beat featuring gentle, melodic guitar riffs. The guitar should be the focal point, supported by subtle, ambient electronic elements and a smooth, relaxed rhythm. Ensure the track is continuous with no background noise or interruptions, maintaining a warm and mellow atmosphere throughout.",
    "Create an ambient lo-fi beat with a tranquil and ethereal atmosphere. Use soft, atmospheric pads, gentle melodies, and minimalistic percussion to evoke a sense of calm and serenity. Ensure the track is continuous with no background noise or interruptions, maintaining a soothing and immersive ambiance throughout.",
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
		// Cache for 5 minutes (300 seconds)
		await env.LOFI_CACHE.put(clipKey, audioData, { expirationTtl: 300 });
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
