import { FatalError, sleep } from "workflow";

import {
	activateRegistrationStep,
	checkRegistrationOrderStep,
	failRegistrationStep,
	submitRegistrationOrderStep,
} from "./steps";

const pollAttempts = 40;

const waitForOrder = async ({ attempt, orderId }: { attempt: number; orderId: string }): Promise<string> => {
	const status = await checkRegistrationOrderStep(orderId);

	if (status !== "pending" || attempt >= pollAttempts) {
		return status;
	}

	await sleep(attempt < 10 ? "15s" : "1m");

	return waitForOrder({ attempt: attempt + 1, orderId });
};

const submitOrder = async (registrationId: string) => {
	try {
		const orderId = await submitRegistrationOrderStep(registrationId);

		if (!orderId) {
			throw new FatalError("Registration is no longer pending");
		}

		return orderId;
	} catch (error) {
		await failRegistrationStep({
			cause: error instanceof Error ? error.message : "Unknown error",
			code: "ORDER_REJECTED",
			registrationId,
		});
		throw error;
	}
};

export const registerDomainWorkflow = async (registrationId: string) => {
	"use workflow";
	const orderId = await submitOrder(registrationId);
	const status = await waitForOrder({ attempt: 1, orderId });

	if (status !== "completed") {
		await failRegistrationStep({ code: status === "pending" ? "ORDER_TIMEOUT" : "ORDER_FAILED", registrationId });

		return;
	}

	await activateRegistrationStep(registrationId);
};
