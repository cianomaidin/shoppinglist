import { useState, useEffect, useRef } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { supabase } from './supabase'
import './index.css'

const LISTS_TABLE = 'lists'
const ITEMS_TABLE = 'shopping_items'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function App() {
  const [activeList, setActiveList] = useState(null)
  const [items, setItems] = useState([])
  const [completedLists, setCompletedLists] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [emoji, setEmoji] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [expandedItem, setExpandedItem] = useState(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const emojiPickerRef = useRef(null)

  useEffect(() => {
    getOrCreateActiveList()
    fetchCompletedLists()
  }, [])

  // Re-subscribe to items whenever the active list changes
  useEffect(() => {
    if (!activeList) return

    async function fetchItems() {
      const { data } = await supabase
        .from(ITEMS_TABLE)
        .select('*')
        .eq('list_id', activeList.id)
        .order('created_at', { ascending: true })
      if (data) setItems(data)
    }
    fetchItems()

    const channel = supabase
      .channel(`items_${activeList.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: ITEMS_TABLE, filter: `list_id=eq.${activeList.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) => prev.map((i) => (i.id === payload.new.id ? payload.new : i)))
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [activeList?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function getOrCreateActiveList() {
    const { data } = await supabase
      .from(LISTS_TABLE)
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      setActiveList(data[0])
    } else {
      const { data: newList } = await supabase
        .from(LISTS_TABLE)
        .insert({ name: `Shop · ${formatDate(new Date())}`, status: 'active' })
        .select()
        .single()
      setActiveList(newList)
    }
  }

  async function fetchCompletedLists() {
    const { data } = await supabase
      .from(LISTS_TABLE)
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
    if (data) setCompletedLists(data)
  }

  async function completeList() {
    if (!activeList) return
    const completedName = `Shop · ${formatDate(new Date())}`
    await supabase
      .from(LISTS_TABLE)
      .update({ status: 'completed', completed_at: new Date().toISOString(), name: completedName })
      .eq('id', activeList.id)

    const { data: newList } = await supabase
      .from(LISTS_TABLE)
      .insert({ name: `Shop · ${formatDate(new Date())}`, status: 'active' })
      .select()
      .single()

    setItems([])
    setActiveList(newList)
    setConfirmComplete(false)
    fetchCompletedLists()
  }

  async function useAsTemplate(list) {
    const { data: templateItems } = await supabase
      .from(ITEMS_TABLE)
      .select('*')
      .eq('list_id', list.id)

    if (!templateItems || templateItems.length === 0) return

    let targetListId = activeList?.id

    // If current list already has items, complete it first and start fresh
    if (items.length > 0) {
      await supabase
        .from(LISTS_TABLE)
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activeList.id)

      const { data: newList } = await supabase
        .from(LISTS_TABLE)
        .insert({ name: `Shop · ${formatDate(new Date())}`, status: 'active' })
        .select()
        .single()

      setActiveList(newList)
      targetListId = newList.id
      fetchCompletedLists()
    }

    const newItems = templateItems.map(({ name, quantity, notes, emoji }) => ({
      list_id: targetListId,
      name,
      quantity,
      notes,
      emoji,
      checked: false,
    }))

    await supabase.from(ITEMS_TABLE).insert(newItems)
    setShowHistory(false)
  }

  async function addItem(e) {
    e.preventDefault()
    if (!name.trim() || !activeList) return
    await supabase.from(ITEMS_TABLE).insert({
      list_id: activeList.id,
      name: name.trim(),
      quantity: quantity.trim(),
      notes: notes.trim(),
      emoji,
      checked: false,
    })
    setName('')
    setQuantity('')
    setNotes('')
    setEmoji('')
  }

  async function toggleChecked(item) {
    await supabase.from(ITEMS_TABLE).update({ checked: !item.checked }).eq('id', item.id)
  }

  async function deleteItem(id) {
    await supabase.from(ITEMS_TABLE).delete().eq('id', id)
  }

  async function updateField(id, field, value) {
    await supabase.from(ITEMS_TABLE).update({ [field]: value }).eq('id', id)
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-gray-800">Shopping List</h1>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
          >
            {showHistory ? 'Back to list' : 'History'}
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-6">shared in real-time</p>

        {showHistory ? (
          <HistoryPanel
            completedLists={completedLists}
            onUseAsTemplate={useAsTemplate}
          />
        ) : (
          <>
            {/* Add item form */}
            <form
              onSubmit={addItem}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="w-11 h-11 rounded-xl border border-gray-200 text-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    {emoji || '＋'}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-13 left-0 z-50">
                      <EmojiPicker
                        onEmojiClick={(data) => {
                          setEmoji(data.emoji)
                          setShowEmojiPicker(false)
                        }}
                        height={350}
                        width={300}
                      />
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Item name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  placeholder="Qty"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium transition-colors"
              >
                Add to list
              </button>
            </form>

            {/* Empty state */}
            {unchecked.length === 0 && checked.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                Your list is empty. Add something above!
              </p>
            )}

            <ItemList
              items={unchecked}
              onToggle={toggleChecked}
              onDelete={deleteItem}
              onUpdate={updateField}
              expandedItem={expandedItem}
              setExpandedItem={setExpandedItem}
            />

            {checked.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  In the cart ({checked.length})
                </p>
                <ItemList
                  items={checked}
                  onToggle={toggleChecked}
                  onDelete={deleteItem}
                  onUpdate={updateField}
                  expandedItem={expandedItem}
                  setExpandedItem={setExpandedItem}
                  muted
                />
              </div>
            )}

            {/* Complete list button */}
            {items.length > 0 && (
              <div className="mt-8">
                {confirmComplete ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="text-sm text-gray-600 mb-3">Complete this list and start a new one?</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setConfirmComplete(false)}
                        className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={completeList}
                        className="px-4 py-2 text-sm rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
                      >
                        Complete list
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmComplete(true)}
                    className="w-full py-2 text-sm rounded-xl border border-gray-200 text-gray-400 hover:text-green-600 hover:border-green-300 transition-colors"
                  >
                    Complete &amp; start new list
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function HistoryPanel({ completedLists, onUseAsTemplate }) {
  const [expandedList, setExpandedList] = useState(null)
  const [listItems, setListItems] = useState({})

  async function toggleList(list) {
    if (expandedList === list.id) {
      setExpandedList(null)
      return
    }
    setExpandedList(list.id)
    if (!listItems[list.id]) {
      const { data } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('list_id', list.id)
        .order('created_at', { ascending: true })
      setListItems((prev) => ({ ...prev, [list.id]: data || [] }))
    }
  }

  if (completedLists.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-8">
        No completed lists yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {completedLists.map((list) => (
        <div key={list.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleList(list)}
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{list.name}</p>
              <p className="text-xs text-gray-400">{formatDate(list.completed_at)}</p>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expandedList === list.id ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {expandedList === list.id && (
            <div className="border-t border-gray-100 px-4 py-3">
              {listItems[list.id] ? (
                <>
                  <ul className="flex flex-col gap-1 mb-3">
                    {listItems[list.id].map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{item.emoji || '🛒'}</span>
                        <span className={item.checked ? 'line-through text-gray-400' : ''}>{item.name}</span>
                        {item.quantity && (
                          <span className="text-xs text-gray-400">× {item.quantity}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onUseAsTemplate(list)}
                    className="w-full py-2 text-sm rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors"
                  >
                    Use as template
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400">Loading...</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ItemList({ items, onToggle, onDelete, onUpdate, expandedItem, setExpandedItem, muted }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          isExpanded={expandedItem === item.id}
          onExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
          muted={muted}
        />
      ))}
    </ul>
  )
}

function ItemRow({ item, onToggle, onDelete, onUpdate, isExpanded, onExpand, muted }) {
  const [editingEmoji, setEditingEmoji] = useState(false)
  const emojiRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setEditingEmoji(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <li className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggle(item)}
          className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-indigo-400'
          }`}
        >
          {item.checked && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="relative" ref={emojiRef}>
          <button
            type="button"
            onClick={() => setEditingEmoji((v) => !v)}
            className="text-xl w-7 text-center hover:scale-125 transition-transform"
            title="Change emoji"
          >
            {item.emoji || '🛒'}
          </button>
          {editingEmoji && (
            <div className="absolute top-9 left-0 z-50">
              <EmojiPicker
                onEmojiClick={(data) => {
                  onUpdate(item.id, 'emoji', data.emoji)
                  setEditingEmoji(false)
                }}
                height={350}
                width={300}
              />
            </div>
          )}
        </div>

        <span className={`flex-1 text-sm font-medium text-gray-800 ${item.checked ? 'line-through text-gray-400' : ''}`}>
          {item.name}
        </span>

        {item.quantity && (
          <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
            {item.quantity}
          </span>
        )}

        <button
          onClick={onExpand}
          className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
        >
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          onClick={() => onDelete(item.id)}
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-100">
          <textarea
            defaultValue={item.notes}
            onBlur={(e) => onUpdate(item.id, 'notes', e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full mt-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="flex gap-2 mt-2 items-center">
            <span className="text-xs text-gray-400">Quantity:</span>
            <input
              type="text"
              defaultValue={item.quantity}
              onBlur={(e) => onUpdate(item.id, 'quantity', e.target.value)}
              placeholder="e.g. 2, 500g"
              className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-24"
            />
          </div>
        </div>
      )}
    </li>
  )
}

export default App
