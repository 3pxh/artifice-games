import { h, Fragment } from "preact"
import { useContext, useEffect, useState } from "preact/hooks"
import { httpsCallable } from "@firebase/functions";
import { collection, doc, addDoc, getDocs, onSnapshot } from "@firebase/firestore";
import { firestore, auth, functions } from "./firebaseClient";
import { AuthContext } from "./AuthProvider"

type Subscription = {
  status: string,
  created: {seconds: number}
  current_period_end: {seconds: number}
  current_period_start: {seconds: number}
  canceled_at?: {seconds: number}
  cancel_at_period_end?: boolean
}
export default function Support() {
  const authContext = useContext(AuthContext);
  const [subscriptionData, setSubscriptionData] = useState<Subscription | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);
  const [priceIds, setPriceIds] = useState<{interval: "month" | "year", unit_amount: number, id: string}[]>([])

  const getProducts = async () => {
    // const products = await getDocs(query(collection(firestore, "products"), where("active", "==", true)));
    const products = await getDocs(collection(firestore, "products"));
    products.forEach(async p => {
      const priceSnap = await getDocs(collection(p.ref, "prices"));
        priceSnap.docs.forEach((doc) => {
          const docData = doc.data();
          const newPriceId = {
            id: doc.id,
            interval: docData.interval,
            unit_amount: docData.unit_amount,
          }
          setPriceIds(p => [...p, newPriceId]);
        });
    });
  }
  useEffect(() => {
    getProducts();
    if (authContext.user) {
      // MUST pass "true" or it won't force refresh the token with updated sub data
      authContext.user.getIdTokenResult(true)
      .then((idTokenResult) => {
        if (idTokenResult.claims.stripeRole === "underwriter") {
          const sub = collection(firestore, `customers/${auth.currentUser!.uid}/subscriptions`)
          onSnapshot(sub, (snap) => {
            // TODO: #billing what if they have purchased/canceled several subscriptions?
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

  const redirectForPrice = (dollars: number, interval: "month" | "year") => {
    const unit_amount = 100 * dollars;
    const p = priceIds.find(p => p.interval === interval && p.unit_amount === unit_amount);
    if (!p) {
      console.error(`No price id for ${unit_amount}/${interval}`);
    } else {
      goToStripe(p.id);
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
    // TODO: #loading Currently this flashes even if they have subscriptionData due to it loading.
    const creditCardMonthly = monthlyFee ? Math.floor(100*(monthlyFee*.029 + .3)/monthlyFee) : 0;
    const creditCardAnnual = monthlyFee ? Math.ceil(100*(12*monthlyFee*.029 + .3)/(12*monthlyFee)) : 0;
    const suggestions = [["50k", "2.50", "30"], ["100k", "5.00", "60"], ["150k", "10.00", "120"]]
    return <div class="Support">
      <h2>Give what you feel</h2>
      <p>Thanks for playing! I hope you're having fun, and I'm looking forward to sharing more games with you.</p>
      <p>I feel that fun is a public good and I'd like a more generous world, so Artifice subscriptions are on a sliding scale where you pay what you want.</p>
      <p>If you know what you'd like to pay, select from the dropdown below. Some people I've talked to prefer a bit of guidance, so here are <strong>optional suggestions</strong> based on income:</p>
      <table cellPadding={0} cellSpacing={0} className="Support-PriceTable">
        <tr>
          <td>Income</td>
          <td>Monthly</td>
          <td>Annually</td>
        </tr>
        {suggestions.map(([income, monthly, annually]) => {
          return <tr>
            <td>{income}/year</td>
            <td><button onClick={() => redirectForPrice(parseFloat(monthly), "month")}>${monthly}/month</button></td>
            <td><button onClick={() => redirectForPrice(parseFloat(annually), "year")}>${annually}/year</button></td>
          </tr>
        })}
        <tr>
          <td></td>
          <td>
            <select onChange={(e) => {
              const s = (e.target as HTMLSelectElement);
              setMonthlyFee(s.value === "custom" ? null : parseInt(s.value.substring(1)))
            }}>
              <option>custom</option>
              {new Array(15).fill(0).map((_, i) => {
                return <option selected={(i+1) === monthlyFee}>${i+1}</option>
              })}
            </select>
            {monthlyFee ? <button onClick={() => redirectForPrice(monthlyFee, "month")}>/month</button> : ""}
          </td>
          <td>
            {monthlyFee ? <button onClick={() => redirectForPrice(12*monthlyFee, "year")}>${12*monthlyFee}/year</button> : ""}
          </td>
        </tr>
      </table>
      {monthlyFee && (creditCardMonthly - creditCardAnnual) > 10  ? <>
        <h3>A note on credit cards</h3>
        <p>Credit card fees on ${monthlyFee} are over {creditCardMonthly}%, but when paid annually this goes down to under {creditCardAnnual}%, which means more funding for me to to make great games. If you have the means and enjoy the games it really helps if you subscribe annually at this pricepoint.</p>
      </>
      : ""}
      <p>Thanks for your support, and party on!</p>
      <p>-George</p>
    </div>
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
      // TODO: #billing we should show price selection in this case.
      return <>
        Your subscription expired on {endDate}<br/>
      </>
    } else {
      return <>
        <p>Your subscription is active and will renew on {endDate}</p>
        <button onClick={goToPortal}>Manage your subscription on Stripe</button>
      </>
    }
  } else {
    return <>
      User data not found.
    </>
  }
}