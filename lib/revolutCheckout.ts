export type RevolutCheckoutMode = "sandbox" | "prod";

export type RevolutCheckoutInstance = {
  payWithPopup: (options?: {
    name?: string;
    email?: string;
    phone?: string;
    billingAddress?: {
      countryCode: string;
      postcode?: string;
      city?: string;
      streetLine1?: string;
      streetLine2?: string;
      region?: string;
    };
    onSuccess?: () => void;
    onError?: (error: { message?: string }) => void;
    onCancel?: () => void;
  }) => void;
  destroy?: () => void;
};

type RevolutCheckoutFn = (
  token: string,
  mode?: RevolutCheckoutMode
) => Promise<RevolutCheckoutInstance>;

declare global {
  interface Window {
    RevolutCheckout?: RevolutCheckoutFn;
  }
}

const SCRIPT_ID = "revolut-checkout-embed";

function clientRevolutMode(): RevolutCheckoutMode {
  const raw = (process.env.NEXT_PUBLIC_REVOLUT_MODE || "sandbox")
    .trim()
    .toLowerCase();
  return raw === "live" || raw === "prod" ? "prod" : "sandbox";
}

export function loadRevolutCheckout(): Promise<RevolutCheckoutFn> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Revolut Checkout requires a browser."));
  }
  if (window.RevolutCheckout) {
    return Promise.resolve(window.RevolutCheckout);
  }

  const mode = clientRevolutMode();
  const src =
    mode === "prod"
      ? "https://merchant.revolut.com/embed.js"
      : "https://sandbox-merchant.revolut.com/embed.js";

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.RevolutCheckout) resolve(window.RevolutCheckout);
        else reject(new Error("Revolut Checkout failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Revolut Checkout script error."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (window.RevolutCheckout) resolve(window.RevolutCheckout);
      else reject(new Error("Revolut Checkout failed to initialize."));
    };
    script.onerror = () =>
      reject(new Error("Could not load Revolut Checkout script."));
    document.body.appendChild(script);
  });
}
