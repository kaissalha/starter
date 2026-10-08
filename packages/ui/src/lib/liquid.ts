export type Rgb = [number, number, number];

export type Palette = "blue" | "green" | "orange" | "purple" | "red";

export type Liquid = {
	destroy: () => void;
	set: (next: Partial<{ mouse: [number, number]; palette: Palette; seed: number }>) => void;
	setMask: (source: CanvasImageSource | null) => void;
};

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform float u_seed; uniform vec2 u_mouse; uniform float u_speed;
uniform vec3 u_c0; uniform vec3 u_c1; uniform vec3 u_c2;

vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  float a = dot(hash2(i)-.5, f), b = dot(hash2(i+vec2(1,0))-.5, f-vec2(1,0));
  float c = dot(hash2(i+vec2(0,1))-.5, f-vec2(0,1)), d = dot(hash2(i+vec2(1,1))-.5, f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y) * 2.;
}
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.02 + 7.3; a *= .5; } return v; }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (uv - .5) * vec2(u_res.x/u_res.y, 1.) * 1.6 + u_seed;
  vec2 d = uv - u_mouse;
  p += .35 * d * exp(-4. * dot(d, d));
  float t = u_time * .12 * u_speed;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(3.1, 1.7) - t));
  vec2 r = vec2(fbm(p + 2.4*q + vec2(1.7, 9.2) + .3*t), fbm(p + 2.4*q + vec2(8.3, 2.8) - .2*t));
  float f = fbm(p + 2.2*r);
  float k = smoothstep(-.35, .55, f + .35*uv.y - .15);
  vec3 col = mix(u_c0, u_c1, smoothstep(0., .55, k));
  col = mix(col, u_c2, smoothstep(.55, 1., k));
  col *= 1. - .55*smoothstep(.04, 0., abs(f + .1));
  gl_FragColor = vec4(col, 1.);
}`;

const SETTLE = 0.0005;

const EASE = 0.08;

const FIELD_SCALE = 0.5;

const FRAME_MS = 1000 / 30 - 4;

export const hexToRgb = (hex: string): Rgb => {
	const n = Number.parseInt(hex.slice(1), 16);

	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const readPalette = (element: Element, palette: Palette) => {
	const style = getComputedStyle(element);

	return ["-night", "-deep", ""].map((suffix) =>
		hexToRgb(style.getPropertyValue(`--brand-${palette}${suffix}`).trim())
	);
};

const approach = (from: number, to: number) => from + (to - from) * EASE;

const near = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
	a.every((value, index) => Math.abs(value - b[index]) <= SETTLE);

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
	const shader = gl.createShader(type);

	if (!shader) {
		return null;
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		return shader;
	}

	gl.deleteShader(shader);

	return null;
};

const link = (gl: WebGLRenderingContext) => {
	const vert = compile(gl, gl.VERTEX_SHADER, VERT);
	const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
	const program = gl.createProgram();

	if (!vert || !frag || !program) {
		return null;
	}

	gl.attachShader(program, vert);
	gl.attachShader(program, frag);
	gl.linkProgram(program);
	gl.deleteShader(vert);
	gl.deleteShader(frag);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		gl.deleteProgram(program);

		return null;
	}

	gl.useProgram(program);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, "p");
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	const uniform = (name: string) => gl.getUniformLocation(program, name);

	return {
		buffer,
		program,
		uniforms: {
			colors: [uniform("u_c0"), uniform("u_c1"), uniform("u_c2")],
			mouse: uniform("u_mouse"),
			resolution: uniform("u_res"),
			seed: uniform("u_seed"),
			speed: uniform("u_speed"),
			time: uniform("u_time"),
		},
	};
};

type Instance = {
	context: CanvasRenderingContext2D;
	current: { colors: Array<Array<number>>; mouse: Array<number>; seed: number };
	dirty: boolean;
	inView: boolean;
	mask: CanvasImageSource | null;
	target: { colors: Array<Rgb>; mouse: Array<number>; seed: number };
};

type Renderer = {
	gl: WebGLRenderingContext;
	gpu: NonNullable<ReturnType<typeof link>>;
	instances: Map<Element, Instance>;
	intersection: IntersectionObserver;
	last: number;
	raf: number;
	reduced: MediaQueryList;
	resize: ResizeObserver;
	surface: HTMLCanvasElement;
	teardown: () => void;
};

type Shared = { renderer: Renderer | null };

const shared: Shared = { renderer: null };

const settled = ({ current, target }: Instance) =>
	Math.abs(target.seed - current.seed) <= SETTLE &&
	near(current.mouse, target.mouse) &&
	current.colors.every((color, index) => near(color, target.colors[index]));

const step = ({ current, target }: Instance) => {
	current.seed = approach(current.seed, target.seed);
	current.mouse = current.mouse.map((value, index) => approach(value, target.mouse[index]));
	current.colors = current.colors.map((color, index) =>
		color.map((value, channel) => approach(value, target.colors[index][channel]))
	);
};

const fit = (canvas: HTMLCanvasElement, width: number, height: number) => {
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
};

const render = (renderer: Renderer, instance: Instance, now: number) => {
	const { gl, gpu, surface } = renderer;
	const { canvas } = instance.context;

	if (!canvas.clientWidth || !canvas.clientHeight) {
		return;
	}

	step(instance);
	const width = Math.ceil(canvas.clientWidth * FIELD_SCALE);
	const height = Math.ceil(canvas.clientHeight * FIELD_SCALE);
	const scale = instance.mask ? Math.min(window.devicePixelRatio || 1, 2) : FIELD_SCALE;
	fit(surface, Math.max(surface.width, width), Math.max(surface.height, height));
	fit(canvas, Math.round(canvas.clientWidth * scale), Math.round(canvas.clientHeight * scale));
	gl.viewport(0, 0, width, height);
	instance.current.colors.forEach((color, index) => gl.uniform3fv(gpu.uniforms.colors[index], color));
	gl.uniform2f(gpu.uniforms.resolution, width, height);
	gl.uniform2f(gpu.uniforms.mouse, instance.current.mouse[0], instance.current.mouse[1]);
	gl.uniform1f(gpu.uniforms.time, now / 1000);
	gl.uniform1f(gpu.uniforms.seed, instance.current.seed);
	gl.uniform1f(gpu.uniforms.speed, renderer.reduced.matches ? 0 : 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	const { context } = instance;
	context.globalCompositeOperation = "copy";
	context.drawImage(surface, 0, surface.height - height, width, height, 0, 0, canvas.width, canvas.height);

	if (instance.mask) {
		context.globalCompositeOperation = "destination-in";
		context.drawImage(instance.mask, 0, 0, canvas.width, canvas.height);
	}

	instance.dirty = false;
};

const frame = (renderer: Renderer, now: number) => {
	renderer.raf = 0;

	if (renderer.gl.isContextLost()) {
		return;
	}

	const pending = [...renderer.instances.values()].filter(
		(instance) => instance.inView && (!renderer.reduced.matches || instance.dirty || !settled(instance))
	);

	if (!pending.length) {
		return;
	}

	schedule(renderer);

	if (now - renderer.last < FRAME_MS) {
		return;
	}

	renderer.last = now;
	pending.forEach((instance) => render(renderer, instance, now));
};

const schedule = (renderer: Renderer) => {
	if (!renderer.raf) {
		renderer.raf = requestAnimationFrame((now) => frame(renderer, now));
	}
};

const invalidate = (renderer: Renderer, instance: Instance | undefined) => {
	if (instance) {
		instance.dirty = true;
		schedule(renderer);
	}
};

const createRenderer = (): Renderer | null => {
	const surface = document.createElement("canvas");
	const gl = surface.getContext("webgl", { alpha: false, antialias: false, depth: false });
	const gpu = gl && link(gl);

	if (!gl || !gpu) {
		return null;
	}

	const instances = new Map<Element, Instance>();
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

	const intersection = new IntersectionObserver(
		(entries) =>
			entries.forEach((entry) => {
				const instance = instances.get(entry.target);

				if (instance) {
					instance.inView = entry.isIntersecting;
					invalidate(renderer, instance);
				}
			}),
		{ rootMargin: "100px" }
	);

	const resize = new ResizeObserver((entries) =>
		entries.forEach((entry) => invalidate(renderer, instances.get(entry.target)))
	);

	const onLost = (event: Event) => {
		event.preventDefault();
		cancelAnimationFrame(renderer.raf);
		renderer.raf = 0;
	};

	const onRestored = () => {
		const restored = link(gl);

		if (restored) {
			renderer.gpu = restored;
			instances.forEach((instance) => invalidate(renderer, instance));
		}
	};

	const onReduced = () => instances.forEach((instance) => invalidate(renderer, instance));
	surface.addEventListener("webglcontextlost", onLost);
	surface.addEventListener("webglcontextrestored", onRestored);
	reduced.addEventListener("change", onReduced);

	const renderer: Renderer = {
		gl,
		gpu,
		instances,
		intersection,
		last: 0,
		raf: 0,
		reduced,
		resize,
		surface,
		teardown: () => {
			cancelAnimationFrame(renderer.raf);
			intersection.disconnect();
			resize.disconnect();
			surface.removeEventListener("webglcontextlost", onLost);
			surface.removeEventListener("webglcontextrestored", onRestored);
			reduced.removeEventListener("change", onReduced);

			if (!gl.isContextLost()) {
				gl.deleteBuffer(renderer.gpu.buffer);
				gl.deleteProgram(renderer.gpu.program);
			}

			gl.getExtension("WEBGL_lose_context")?.loseContext();
		},
	};

	return renderer;
};

export const createLiquid = (canvas: HTMLCanvasElement, init: { palette: Palette; seed: number }): Liquid | null => {
	const context = canvas.getContext("2d");
	const renderer = shared.renderer ?? createRenderer();

	if (!context || !renderer) {
		return null;
	}

	shared.renderer = renderer;
	const colors = readPalette(canvas, init.palette);

	const instance: Instance = {
		context,
		current: { colors: colors.map((color) => [...color]), mouse: [0.5, 0.5], seed: init.seed },
		dirty: true,
		inView: false,
		mask: null,
		target: { colors, mouse: [0.5, 0.5], seed: init.seed },
	};

	renderer.instances.set(canvas, instance);
	renderer.intersection.observe(canvas);
	renderer.resize.observe(canvas);

	return {
		destroy: () => {
			renderer.instances.delete(canvas);
			renderer.intersection.unobserve(canvas);
			renderer.resize.unobserve(canvas);

			if (!renderer.instances.size) {
				renderer.teardown();
				shared.renderer = null;
			}
		},
		set: (next) => {
			if (next.palette) {
				instance.target.colors = readPalette(canvas, next.palette);
			}

			if (next.seed !== undefined) {
				instance.target.seed = next.seed;
			}

			if (next.mouse) {
				instance.target.mouse = next.mouse;
			}

			invalidate(renderer, instance);
		},
		setMask: (source) => {
			instance.mask = source;
			invalidate(renderer, instance);
		},
	};
};
