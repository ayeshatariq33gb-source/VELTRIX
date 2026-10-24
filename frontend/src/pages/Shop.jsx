import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Minus, Plus, ShoppingBag } from 'lucide-react'
import { Badge, Button, Field, Modal, PageHeader } from '../components/Workspace'
import api from '../services/api'

const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const imageUrl = (image, width=480) => !image ? '' : image.startsWith('http') || image.startsWith('/') ? image : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=${width}&q=75`
export default function Shop({ products, onPlaced, toast }) {
  const [cart, setCart] = useState({}), [checkout, setCheckout] = useState(false), [method, setMethod] = useState('cod'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const requestKey = useRef('')
  const items = useMemo(() => Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity, product: products.find(p => p.id === productId) })).filter(i => i.product), [cart, products])
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const estimatedTotal = subtotal + (subtotal >= 100 ? 0 : 12) + subtotal * 0.08
  function update(id, amount) { requestKey.current = ''; setCart(rows => { const quantity = (rows[id] || 0) + amount; const next = { ...rows }; if (quantity > 0) next[id] = quantity; else delete next[id]; return next }) }
  async function placeOrder(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), values = Object.fromEntries(form.entries())
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    const body = { idempotencyKey: requestKey.current, items: items.map(i => ({ productId: i.productId, quantity: i.quantity })), paymentMethod: method }
    if (method === 'cod') body.address = { name: values.fullName, phone: values.phone, line1: values.address, city: values.city, region: values.region, postalCode: values.postalCode, country: values.country }
    else body.card = { name: values.cardName, number: values.cardNumber, expiry: values.expiry, cvv: values.cvv }
    try {
      const { data } = await api.post('/orders', body)
      requestKey.current = ''; setCart({}); setCheckout(false)
      const paymentMessage = data.order.paymentStatus === 'paid' ? 'Payment successful.' : 'Payment is due on delivery.'
      toast(`${paymentMessage} Order ${data.order.number} is pending administrator approval.`)
      onPlaced(data.order)
    }
    catch (e) { if (e.response) requestKey.current = ''; setError(e.response?.data?.error || 'Order could not be placed.') }
    finally { setBusy(false) }
  }
  return <><PageHeader eyebrow="PRODUCT CATALOGUE" title="Shop" subtitle="Browse available products and place a test order with live inventory." actions={<Button onClick={()=>setCheckout(true)} disabled={!items.length}><ShoppingBag size={16}/> Cart ({items.reduce((n,i)=>n+i.quantity,0)}) · {money(subtotal)}</Button>}/>
    {!products.length ? <div className="panel empty-state"><b>No products are available</b><span>Ask your workspace administrator to add products.</span></div> : <div className="product-grid">{products.filter(p=>p.status!=='archived').map(p=><article key={p.id} className="product-card"><div className={`product-thumb thumb-large tone-${p.tone||'sand'}`}>{p.image&&<img loading="lazy" src={imageUrl(p.image)} alt=""/>}</div><div className="product-card-content"><div className="product-card-top"><Badge kind={p.stock ? 'green':'red'}>{p.stock ? `${p.stock} available`:'Out of stock'}</Badge></div><h3>{p.name}</h3><span className="product-card-sub">{p.brand} · {p.category}</span><div className="product-card-meta"><b>{money(p.price)}</b><span>{p.sku}</span></div><div className="product-card-actions">{cart[p.id] ? <><Button variant="light" onClick={()=>update(p.id,-1)}><Minus size={14}/></Button><Button variant="light" disabled>{cart[p.id]} in cart</Button><Button onClick={()=>update(p.id,1)} disabled={cart[p.id]>=p.stock}><Plus size={14}/></Button></> : <Button onClick={()=>update(p.id,1)} disabled={!p.stock}>Add to cart <Plus size={14}/></Button>}</div></div></article>)}</div>}
    {checkout&&<Modal title="Checkout" onClose={()=>!busy&&setCheckout(false)} footer={<><Button variant="light" disabled={busy} onClick={()=>setCheckout(false)}>Continue shopping</Button><Button type="submit" form="checkout-form" disabled={busy||!items.length} aria-busy={busy}>{busy?(method==='card-demo'?'Processing payment…':'Submitting order…'):(method==='card-demo'?`Pay ${money(estimatedTotal)} (demo)`:'Place COD order')} <ArrowRight size={14}/></Button></>}><form id="checkout-form" className="form-grid" onSubmit={placeOrder}><div className="form-hint" style={{gridColumn:'1/-1'}}>{items.map(i=><div key={i.productId}>{i.quantity} × {i.product.name} <b>{money(i.product.price*i.quantity)}</b></div>)}<p>Estimated total (server recalculates): <b>{money(estimatedTotal)}</b></p></div><Field label="Payment method"><select value={method} onChange={e=>setMethod(e.target.value)} disabled={busy}><option value="cod">Cash on delivery</option><option value="card-demo">Test card simulator</option></select></Field>{method==='cod'?<><Field label="Full name"><input name="fullName" required maxLength="100" disabled={busy}/></Field><Field label="Phone"><input name="phone" required maxLength="30" disabled={busy}/></Field><Field label="Delivery address"><input name="address" required maxLength="200" disabled={busy}/></Field><Field label="City"><input name="city" required maxLength="100" disabled={busy}/></Field><Field label="State / region"><input name="region" maxLength="100" disabled={busy}/></Field><Field label="Postal code"><input name="postalCode" maxLength="20" disabled={busy}/></Field><Field label="Country"><input name="country" required maxLength="100" defaultValue="United States" disabled={busy}/></Field><p className="form-hint" style={{gridColumn:'1/-1'}}>COD orders start with pending payment. The administrator can confirm and update delivery status.</p></>:<><Field label="Cardholder"><input name="cardName" required autoComplete="off" disabled={busy}/></Field><Field label="Test card number"><input name="cardNumber" required inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" disabled={busy}/></Field><Field label="Expiry (MM/YY)"><input name="expiry" required placeholder="12/30" autoComplete="off" disabled={busy}/></Field><Field label="Fictional CVV"><input name="cvv" required inputMode="numeric" autoComplete="off" disabled={busy}/></Field><p className="form-hint" style={{gridColumn:'1/-1'}}>Demonstration only. Use 4242 4242 4242 4242 for success or 4000 0000 0000 0002 for a decline. Never enter real payment details. Card fields are not saved.</p></>}{error&&<p role="alert" className="form-hint" style={{gridColumn:'1/-1',color:'#a44'}}>{error}</p>}</form></Modal>}
  </>
}
