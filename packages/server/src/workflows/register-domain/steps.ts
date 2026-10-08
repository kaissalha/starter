export const submitRegistrationOrderStep = async (registrationId: string) => {
	"use step";
	const { submitDomainRegistrationOrder } = await import("../../services/websites/domain-registrations");

	return submitDomainRegistrationOrder(registrationId);
};

submitRegistrationOrderStep.maxRetries = 0;

export const checkRegistrationOrderStep = async (orderId: string) => {
	"use step";
	const { checkDomainRegistrationOrder } = await import("../../services/websites/domain-registrations");

	return checkDomainRegistrationOrder(orderId);
};

export const activateRegistrationStep = async (registrationId: string) => {
	"use step";
	const { activateDomainRegistration } = await import("../../services/websites/domain-registrations");
	await activateDomainRegistration(registrationId);
};

export const failRegistrationStep = async ({
	cause,
	code,
	registrationId,
}: {
	cause?: string;
	code: string;
	registrationId: string;
}) => {
	"use step";

	if (cause) {
		const { log } = await import("@starter/observability");
		log.error({ cause, code, message: "Domain registration failed", registrationId });
	}

	const { failDomainRegistration } = await import("../../services/websites/domain-registrations");
	await failDomainRegistration({ code, registrationId });
};
