module.exports = {
	preset: 'jest-preset-angular',
	setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],
	coverageDirectory: 'coverage',
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.spec.ts',
		'!src/main.ts',
		'!src/**/*.module.ts',
	],
	moduleNameMapper: {
		'^src/(.*)$': '<rootDir>/src/$1',
	},
	transform: {
		'^.+\\.(ts|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$',
			},
		],
	},
	transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};
