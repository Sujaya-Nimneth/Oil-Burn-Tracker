'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';

interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryNumber?: number;
}

export default function SubmitDialog({
  open,
  onOpenChange,
  entryNumber
}: SubmitDialogProps) {
  const [humanity, setHumanity] = useState('');
  const [relationship, setRelationship] = useState('');
  const [age, setAge] = useState('');
  const [region, setRegion] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedHumanity = humanity.trim();
  const parsedAge = age.trim() === '' ? null : Number(age);
  const ageValid =
    parsedAge === null ||
    (Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 120);

  const canSubmit =
    trimmedHumanity.length >= 10 &&
    trimmedHumanity.length <= 280 &&
    Boolean(relationship) &&
    Boolean(region) &&
    ageValid;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/memorial/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryNumber: entryNumber ?? null,
          humanity: trimmedHumanity,
          relationship,
          age: parsedAge,
          region,
          photoUrl: photoUrl.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }

      toast.success('Thank you. Your submission is under review.');
      onOpenChange(false);
      setHumanity('');
      setRelationship('');
      setAge('');
      setRegion('');
      setPhotoUrl('');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md border-zinc-800 bg-zinc-950 text-white'>
        <DialogHeader>
          <DialogTitle className='text-white'>
            Remember someone
            {entryNumber ? ` (#${entryNumber.toLocaleString()})` : ''}
          </DialogTitle>
          <DialogDescription className='text-zinc-400'>
            Tell us who they were. Submissions open a public review issue on
            GitHub — please do not include private contact details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Who were they */}
          <div>
            <label
              htmlFor='memorial-humanity'
              className='mb-1 block text-sm text-zinc-300'
            >
              Who were they? <span className='text-red-500'>*</span>
            </label>
            <Textarea
              id='memorial-humanity'
              value={humanity}
              onChange={(e) => setHumanity(e.target.value)}
              placeholder='A mother of three who sang while she cooked'
              maxLength={280}
              required
              className='min-h-20 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500'
            />
            <span className='mt-1 block text-xs text-zinc-400'>
              {trimmedHumanity.length}/280 (minimum 10 characters)
            </span>
          </div>

          {/* Relationship */}
          <div>
            <label
              htmlFor='memorial-relationship'
              className='mb-1 block text-sm text-zinc-300'
            >
              Your relationship <span className='text-red-500'>*</span>
            </label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger
                id='memorial-relationship'
                className='w-full border-zinc-700 bg-zinc-900 text-white'
              >
                <SelectValue placeholder='Select...' />
              </SelectTrigger>
              <SelectContent className='border-zinc-700 bg-zinc-900'>
                <SelectItem value='family'>Family member</SelectItem>
                <SelectItem value='friend'>Friend</SelectItem>
                <SelectItem value='neighbor'>Neighbor</SelectItem>
                <SelectItem value='colleague'>Colleague</SelectItem>
                <SelectItem value='community'>Community member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Age + Region row */}
          <div className='flex gap-3'>
            <div className='w-24'>
              <label
                htmlFor='memorial-age'
                className='mb-1 block text-sm text-zinc-300'
              >
                Age
              </label>
              <Input
                id='memorial-age'
                type='number'
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={0}
                max={120}
                placeholder='—'
                className='border-zinc-700 bg-zinc-900 text-white'
              />
            </div>
            <div className='flex-1'>
              <label
                htmlFor='memorial-region'
                className='mb-1 block text-sm text-zinc-300'
              >
                Region <span className='text-red-500'>*</span>
              </label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger
                  id='memorial-region'
                  className='w-full border-zinc-700 bg-zinc-900 text-white'
                >
                  <SelectValue placeholder='Select...' />
                </SelectTrigger>
                <SelectContent className='border-zinc-700 bg-zinc-900'>
                  <SelectItem value='Gaza'>Gaza</SelectItem>
                  <SelectItem value='West Bank'>West Bank</SelectItem>
                  <SelectItem value='Lebanon'>Lebanon</SelectItem>
                  <SelectItem value='Israel'>Israel</SelectItem>
                  <SelectItem value='Iran'>Iran</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label
              htmlFor='memorial-photo'
              className='mb-1 block text-sm text-zinc-300'
            >
              Photo link
            </label>
            <Input
              id='memorial-photo'
              type='url'
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder='https://...'
              className='border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500'
            />
            <span className='mt-1 block text-xs text-zinc-400'>
              Optional — link to a hosted photo
            </span>
          </div>

          {/* Submit */}
          <Button
            type='submit'
            disabled={!canSubmit || submitting}
            className='w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-40'
          >
            {submitting ? 'Submitting...' : 'Submit memory'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
