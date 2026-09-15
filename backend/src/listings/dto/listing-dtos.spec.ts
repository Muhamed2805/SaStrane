import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';
import { UpdateListingDto } from './update-listing.dto';

describe('Listing DTOs', () => {
  it('trims listing text before validation', async () => {
    const dto = plainToInstance(CreateListingDto, {
      title: '  Košenje dvorišta  ',
      category: '  Košenje trave  ',
      location: '  Sarajevo  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual(
      expect.objectContaining({
        title: 'Košenje dvorišta',
        category: 'Košenje trave',
        location: 'Sarajevo',
      }),
    );
  });

  it('rejects a title containing only whitespace', async () => {
    const dto = plainToInstance(CreateListingDto, {
      title: '   ',
      category: 'Ostalo',
      location: 'Sarajevo',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'title' })]),
    );
  });

  it('rejects fields that exceed their storage limits', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      title: 'a'.repeat(121),
      description: 'a'.repeat(2001),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['title', 'description']),
    );
  });

  it('allows nullable optional fields to be cleared during an update', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      budget: null,
      description: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
