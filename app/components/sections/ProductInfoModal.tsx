'use client'

type Props = {
  csvFile: File | null
  productName: string
  setProductName: (v: string) => void
  productNameError: string
  setProductNameError: (v: string) => void
  productCategory: string
  setProductCategory: (v: string) => void
  productCategoryError: string
  setProductCategoryError: (v: string) => void
  productPrice: string
  setProductPrice: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

export default function ProductInfoModal({
  csvFile, productName, setProductName, productNameError, setProductNameError,
  productCategory, setProductCategory, productCategoryError, setProductCategoryError,
  productPrice, setProductPrice, onClose, onSubmit,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Tell us about your product</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Helps us write better fixes and a more accurate SEO score</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-black text-lg leading-none ml-4">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Product name <span className="text-red-500">*</span></label>
            <input type="text" value={productName} onChange={e => { setProductName(e.target.value); setProductNameError('') }}
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              placeholder="e.g. Handmade Ceramic Coffee Mug" autoFocus
              className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none focus:border-orange-400 transition-colors ${productNameError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`} />
            {productNameError && <p className="text-xs text-red-500 mt-1">{productNameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Product category <span className="text-red-500">*</span></label>
            <select value={productCategory} onChange={e => { setProductCategory(e.target.value); setProductCategoryError('') }}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none focus:border-orange-400 transition-colors bg-white ${productCategoryError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}>
              <option value="">Select a category...</option>
              {['Electronics','Kitchen & Home','Health & Personal Care','Beauty','Clothing & Apparel','Sports & Outdoors','Toys & Games','Baby','Pet Supplies','Tools & Home Improvement','Books & Media','Food & Grocery','Automotive','Office Products','Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {productCategoryError && <p className="text-xs text-red-500 mt-1">{productCategoryError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Listing price <span className="text-neutral-400 font-normal">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
              <input type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="29.99"
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">Cancel</button>
          <button onClick={onSubmit} className="flex-1 py-2.5 text-sm font-medium bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors">Analyze reviews →</button>
        </div>
        <p className="text-[10px] text-neutral-400 text-center mt-3">File: {csvFile?.name ?? ''} · {csvFile ? Math.round(csvFile.size / 1024) : 0}KB</p>
      </div>
    </div>
  )
}
