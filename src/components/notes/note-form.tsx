"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createNote, updateNote } from "@/lib/actions/notes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { VditorEditor } from "./vditor-editor"
import { cn } from "@/lib/utils"
import { Loader2, Save } from "lucide-react"
import type { Note, NoteTag, Tag } from "@prisma/client"

// Vditor CSS
import "vditor/dist/index.css"

type NoteWithTags = Note & { noteTags: (NoteTag & { tag: Tag })[] }

interface NoteFormProps {
  note?: NoteWithTags
  tags: Tag[]
}

export function NoteForm({ note, tags }: NoteFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState(note?.title ?? "")
  const [summary, setSummary] = useState(note?.summary ?? "")
  const [contentMd, setContentMd] = useState(note?.contentMd ?? "")
  const [type, setType] = useState<string>(note?.type ?? "OTHER")
  const [importance, setImportance] = useState<string>(note?.importance ?? "MEDIUM")
  const [selectedTags, setSelectedTags] = useState<string[]>(note?.noteTags.map((nt) => nt.tagId) ?? [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      if (note) {
        await updateNote(note.id, { title, summary, contentMd, type: type as any, importance: importance as any, tagIds: selectedTags })
        router.push(`/notes/${note.id}`)
      } else {
        const result = await createNote({ title, summary, contentMd, type: type as any, importance: importance as any, isPinned: false, tagIds: selectedTags })
        router.push(`/notes/${result.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label>标题 *</Label>
        <Input placeholder="笔记标题..." value={title} onChange={(e) => setTitle(e.target.value)} className="text-base" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>一句话总结</Label>
        <Input placeholder="用一句话概括这条知识..." value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>类型</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[["ADVICE","建议"],["DECISION","决策"],["PERSON","人物"],["LESSON","经验"],["HEALTH","健康"],["FINANCE","财务"],["OTHER","其他"]].map(([v,l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>重要性</Label>
          <Select value={importance} onValueChange={setImportance}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">低</SelectItem>
              <SelectItem value="MEDIUM">中</SelectItem>
              <SelectItem value="HIGH">高</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>正文</Label>
        <div className="note-vditor-shell glass-flat-panel rounded-lg overflow-hidden">
          <VditorEditor value={contentMd} onChange={setContentMd} />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="space-y-2">
          <Label>标签</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button key={tag.id} type="button" onClick={() => setSelectedTags((prev) => prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id])}>
                <TagChip name={tag.name} color={tag.color} className={cn("cursor-pointer transition-opacity", selectedTags.includes(tag.id) ? "" : "opacity-50 hover:opacity-80")} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>取消</Button>
        <Button type="submit" disabled={isPending || !title.trim()}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />保存</>}
        </Button>
      </div>
    </form>
  )
}
