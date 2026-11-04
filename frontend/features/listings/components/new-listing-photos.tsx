'use client';

import { useEffect, useMemo, useState } from 'react';
import { moveToFront, pickPhotos } from '../photos';
import { PhotoGrid } from './photo-grid';

type NewListingPhotosProps = {
  files: File[];
  disabled?: boolean;
  onChange: (files: File[]) => void;
};

// Photos picked for a job that is not posted yet. They are uploaded after
// the job is created.
export function NewListingPhotos({
  files,
  disabled,
  onChange,
}: NewListingPhotosProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );

  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  return (
    <PhotoGrid
      items={files.map((file, index) => ({
        key: previews[index],
        src: previews[index],
        alt: `Slika ${index + 1}: ${file.name}`,
      }))}
      disabled={disabled}
      errors={errors}
      onAdd={(picked) => {
        const { accepted, errors: pickErrors } = pickPhotos(
          picked,
          files.length,
        );
        setErrors(pickErrors);
        if (accepted.length > 0) onChange([...files, ...accepted]);
      }}
      onRemove={(index) => {
        setErrors([]);
        onChange(files.filter((_, fileIndex) => fileIndex !== index));
      }}
      onMakeCover={(index) => onChange(moveToFront(files, index))}
    />
  );
}
