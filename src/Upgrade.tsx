import { h, Fragment } from "preact"
import { useContext, useEffect, useState } from "preact/hooks"
import { httpsCallable } from "@firebase/functions";
import { collection, doc, addDoc, getDocs, onSnapshot } from "@firebase/firestore";
import { firestore, auth, functions } from "./firebaseClient";
import { AuthContext } from "./AuthProvider"

const getProducts = async () => {
  // const products = await getDocs(query(collection(firestore, "products"), where("active", "==", true)));
  const products = await getDocs(collection(firestore, "products"));
  products.forEach(async p => {
    // console.log("Got product", p.data());
    const priceSnap = await getDocs(collection(p.ref, "prices"));
      priceSnap.docs.forEach((doc) => {
        // console.log(doc.id, " => ", doc.data());
      });
  })
}

type Subscription = {
  status: string,
  created: {seconds: number}
  current_period_end: {seconds: number}
  current_period_start: {seconds: number}
  canceled_at?: {seconds: number}
  cancel_at_period_end?: boolean
}
export default function Upgrade() {
  const authContext = useContext(AuthContext);
  const [subscriptionData, setSubscriptionData] = useState<Subscription | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    getProducts();
    if (authContext.user) {
      // MUST pass "true" or it won't force refresh the token with updated sub data
      authContext.user.getIdTokenResult(true)
      .then((idTokenResult) => {
        if (idTokenResult.claims.stripeRole === "underwriter") {
          const sub = collection(firestore, `customers/${auth.currentUser!.uid}/subscriptions`)
          onSnapshot(sub, (snap) => {
            // TODO: what if they have purchased/canceled several subscriptions?
            // Find the Subscription with the most recent created.seconds, or ends last
            // console.log("how many subs?", snap.docs.length)
            console.log(snap.docs[0].data());
            setSubscriptionData(snap.docs[0].data() as Subscription);
          });
        } else {
          setSubscriptionData(null);
        }
      })
      .catch((error) => {
        console.log(error);
      });
    }
  }, [authContext.user]);

  const goToStripe = async (price: string) => {
    if (auth.currentUser) {
      setIsWaiting(true);
      const customers = collection(firestore, "customers");
      const checkout = collection(doc(customers, auth.currentUser.uid), "checkout_sessions");
      const r = await addDoc(checkout, {
        mode: "subscription",
        price: price, // One-time price created in Stripe
        success_url: window.location.href,
        cancel_url: window.location.href,
      });
      onSnapshot(r, (snap) => {
        const { error, url } = snap.data()!;
        if (error) {
          console.error(`An error occured: ${error.message}`);
          setIsWaiting(false);
        }
        if (url) {
          window.location.assign(url);
        }
      });
    }
  }

  const goToPortal = async () => {
    setIsWaiting(true);
    const { data } = await httpsCallable(functions, "ext-firestore-stripe-payments-createPortalLink")({
      returnUrl: window.location.href
    });
    window.location.assign((data as any).url);
  }

  if (isWaiting) {
    return <>Redirecting to Stripe...</>
  } else if (authContext.user && !subscriptionData) {
    return <>
      Become a member
      <button onClick={() => goToStripe("price_1MhFwJBNzXU0egqMLIau8CbD")}>Subscribe for $5/month</button>
      <button onClick={() => goToStripe("price_1MhFwJBNzXU0egqMQ8SHjtuP")}>Or $45/year (3.75/month!)</button>
    </>
  } else if (authContext.user && subscriptionData) {
    const nowS = new Date().getTime() / 1000;
    const endDate = new Date(1000*subscriptionData.current_period_end.seconds).toLocaleDateString("en-us", { weekday:"long", month:"short", day:"numeric", year: "numeric"});
    if (subscriptionData.cancel_at_period_end && 
      nowS < subscriptionData.current_period_end.seconds
    ) {
      return <>
        Your subscription has been discontinued and will end on {endDate}<br/>
        <button onClick={goToPortal}>Reactivate your subscription on Stripe</button>
      </>
    } else if (
      subscriptionData.cancel_at_period_end && 
      nowS >= subscriptionData.current_period_end.seconds
    ) {
      return <>
        Your subscription expired on {endDate}<br/>
        Restart your membership<br/>
        <button onClick={() => goToStripe("price_1MhFwJBNzXU0egqMLIau8CbD")}>Subscribe for $5/month</button>
        <button onClick={() => goToStripe("price_1MhFwJBNzXU0egqMQ8SHjtuP")}>Or $45/year (3.75/month!)</button>
      </>
    } else {
      return <>
        <button onClick={goToPortal}>Manage your subscription on Stripe</button>
      </>
    }
  } else {
    return <>
      User data not found.
    </>
  }
}