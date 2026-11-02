import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto.js';
import { UpdateListingDto } from './update-listing.dto.js';

const validListing = {
  title: 'Košenje dvorišta',
  category: 'LAWN_MOWING',
  location: 'SARAJEVO',
};

async function invalidFields(dto: object) {
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('Listing DTOs', () => {
  it('trims listing text before validation', async () => {
    const dto = plainToInstance(CreateListingDto, {
      ...validListing,
      title: '  Košenje dvorišta  ',
      description: '  Dvorište od 400 m².  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      title: 'Košenje dvorišta',
      description: 'Dvorište od 400 m².',
    });
  });

  it('rejects a title containing only whitespace', async () => {
    const dto = plainToInstance(CreateListingDto, {
      ...validListing,
      title: '   ',
    });

    await expect(invalidFields(dto)).resolves.toEqual(['title']);
  });

  it('accepts only the fixed categories and locations', async () => {
    const dto = plainToInstance(CreateListingDto, {
      ...validListing,
      category: 'Košenje trave',
      location: 'Beograd',
    });

    await expect(invalidFields(dto)).resolves.toEqual(['category', 'location']);
  });

  it('accepts a budget in whole KM within the limit', async () => {
    for (const budget of [1, 100_000]) {
      const dto = plainToInstance(CreateListingDto, {
        ...validListing,
        budget,
      });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
    for (const budget of [0, 100_001, 12.5, '50 KM']) {
      const dto = plainToInstance(CreateListingDto, {
        ...validListing,
        budget,
      });
      await expect(invalidFields(dto)).resolves.toEqual(['budget']);
    }
  });

  it('rejects fields that exceed their storage limits', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      title: 'a'.repeat(121),
      description: 'a'.repeat(2001),
    });

    await expect(invalidFields(dto)).resolves.toEqual(['title', 'description']);
  });

  it('allows the budget and description to be cleared during an update', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      budget: null,
      description: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('does not allow a required field to be cleared during an update', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      title: null,
      category: null,
      location: null,
    });

    await expect(invalidFields(dto)).resolves.toEqual([
      'title',
      'category',
      'location',
    ]);
  });
});
