import { Section } from "react-email";

export const Logo = () => {
	return (
		<Section className='mt-8'>
			<svg viewBox='0 0 100 130' xmlns='http://www.w3.org/2000/svg'>
				<polygon fill='black' points='50,50 65,65 50,80 35,65' />
				<line stroke='black' strokeWidth='5' x1='50' x2='50' y1='17' y2='56' />
				<line stroke='black' strokeWidth='5' x1='2' x2='38' y1='65' y2='65' />
				<line stroke='black' strokeWidth='5' x1='62' x2='98' y1='65' y2='65' />
				<line className='ray' stroke='black' strokeWidth='5' x1='36' x2='20' y1='48' y2='32' />
				<line className='ray' stroke='black' strokeWidth='5' x1='64' x2='80' y1='48' y2='32' />
				<line stroke='black' strokeWidth='5' x1='50' x2='50' y1='76' y2='113' />
				<line className='ray' stroke='black' strokeWidth='5' x1='36' x2='20' y1='82' y2='98' />
				<line className='ray' stroke='black' strokeWidth='5' x1='64' x2='80' y1='82' y2='98' />
			</svg>
		</Section>
	);
};
