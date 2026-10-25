"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import Loader from "@/components/loader";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

function LoginForms() {
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirect");
	const [showSignIn, setShowSignIn] = useState(false);

	return showSignIn ? (
		<SignInForm
			onSwitchToSignUp={() => setShowSignIn(false)}
			redirectTo={redirectTo}
		/>
	) : (
		<SignUpForm
			onSwitchToSignIn={() => setShowSignIn(true)}
			redirectTo={redirectTo}
		/>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<Loader />}>
			<LoginForms />
		</Suspense>
	);
}
