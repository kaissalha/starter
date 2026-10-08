import { cache } from "react";

import { headers } from "next/headers";

import { auth } from "@starter/server/auth";

import "server-only";

export const getServerSession = cache(async () => auth.api.getSession({ headers: await headers() }));
